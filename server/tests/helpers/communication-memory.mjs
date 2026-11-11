import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
export const field = (row, path) =>
  path.split(".").reduce((value, key) => value?.[key], row);
const equal = (a, b) =>
  a instanceof Date && b instanceof Date
    ? a.getTime() === b.getTime()
    : a instanceof ObjectId || b instanceof ObjectId
      ? String(a) === String(b)
      : a === b;
function expression(value, row, variables = {}) {
  if (typeof value === "string") {
    if (value === "$$ROOT") return row;
    if (value.startsWith("$$")) return variables[value.slice(2)];
    if (value.startsWith("$")) return field(row, value.slice(1));
    return value;
  }
  if (
    !value ||
    typeof value !== "object" ||
    value instanceof Date ||
    value instanceof ObjectId
  )
    return value;
  if (Array.isArray(value))
    return value.map((item) => expression(item, row, variables));
  const get = (item) => expression(item, row, variables);
  if ("$literal" in value) return value.$literal;
  if (value.$concat) return value.$concat.map(get).join("");
  if (value.$dateToString)
    return get(value.$dateToString.date).toISOString().slice(0, 7);
  if (value.$toString) return String(get(value.$toString));
  if (value.$convert) {
    try {
      return new ObjectId(get(value.$convert.input));
    } catch {
      return value.$convert.onError;
    }
  }
  if (value.$toObjectId) return new ObjectId(get(value.$toObjectId));
  if (value.$eq) return equal(...value.$eq.map(get));
  if (value.$ne) return !equal(...value.$ne.map(get));
  if (value.$gt) return get(value.$gt[0]) > get(value.$gt[1]);
  if (value.$and) return value.$and.every((item) => get(item));
  if (value.$size) return get(value.$size).length;
  if (value.$ifNull) return get(value.$ifNull[0]) ?? get(value.$ifNull[1]);
  if (value.$cond) return get(value.$cond[get(value.$cond[0]) ? 1 : 2]);
  if (value.$max)
    return value.$max
      .map(get)
      .filter((item) => item !== undefined && item !== null)
      .reduce((a, b) => (a > b ? a : b));
  throw new Error(`Unexpected expression ${JSON.stringify(value)}`);
}
function matches(row, filter, vars) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$expr") return expression(value, row, vars);
    if (key === "$or")
      return value.some((branch) => matches(row, branch, vars));
    const actual = field(row, key);
    if (
      value &&
      typeof value === "object" &&
      !(value instanceof Date) &&
      !(value instanceof ObjectId)
    )
      return Object.entries(value).every(([op, target]) => {
        if (op === "$exists") return (actual !== undefined) === target;
        if (op === "$in") return target.some((item) => equal(item, actual));
        if (op === "$type") return actual instanceof Date;
        if (op === "$ne") return !equal(actual, target);
        if (op === "$lte") return actual <= target;
        if (op === "$gte") return actual >= target;
        if (op === "$lt") return actual < target;
        if (op === "$regex")
          return new RegExp(target, value.$options ?? "").test(actual ?? "");
        if (op === "$options") return true;
        throw new Error(`Unexpected match ${op}`);
      });
    return equal(actual, value);
  });
}
const project = (row, spec, vars) =>
  Object.fromEntries(
    Object.entries(spec)
      .filter(([, flag]) => flag !== 0)
      .map(([key, value]) => [
        key,
        value === 1 ? row[key] : expression(value, row, vars),
      ]),
  );
function evaluate(source, pipeline, collections, vars = {}) {
  let rows = source.map((row) => ({ ...row }));
  for (const stage of pipeline) {
    if (stage.$match)
      rows = rows.filter((row) => matches(row, stage.$match, vars));
    else if (stage.$project)
      rows = rows.map((row) => project(row, stage.$project, vars));
    else if (stage.$unionWith)
      rows = [
        ...rows,
        ...evaluate(
          collections[stage.$unionWith.coll] ?? [],
          stage.$unionWith.pipeline,
          collections,
          vars,
        ),
      ];
    else if (stage.$lookup)
      rows = rows.map((row) => ({
        ...row,
        [stage.$lookup.as]: evaluate(
          collections[stage.$lookup.from] ?? [],
          stage.$lookup.pipeline,
          collections,
          {
            ...vars,
            ...Object.fromEntries(
              Object.entries(stage.$lookup.let).map(([key, value]) => [
                key,
                expression(value, row, vars),
              ]),
            ),
          },
        ),
      }));
    else if (stage.$unwind) {
      const key = stage.$unwind.slice(1);
      rows = rows.flatMap((row) =>
        (row[key] ?? []).map((value) => ({ ...row, [key]: value })),
      );
    } else if (stage.$set)
      rows = rows.map((row) => ({
        ...row,
        ...Object.fromEntries(
          Object.entries(stage.$set).map(([key, value]) => [
            key,
            expression(value, row, vars),
          ]),
        ),
      }));
    else if (stage.$sort)
      rows.sort((a, b) => {
        for (const [key, direction] of Object.entries(stage.$sort)) {
          const av = field(a, key),
            bv = field(b, key);
          if (av > bv) return direction;
          if (av < bv) return -direction;
        }
        return 0;
      });
    else if (stage.$skip !== undefined) rows = rows.slice(stage.$skip);
    else if (stage.$limit) rows = rows.slice(0, stage.$limit);
    else if (stage.$count)
      rows = rows.length ? [{ [stage.$count]: rows.length }] : [];
    else if (stage.$group) {
      const groups = new Map();
      for (const row of rows) {
        const id = expression(stage.$group._id, row, vars);
        const entry = groups.get(id) ?? { _id: id };
        for (const [key, op] of Object.entries(stage.$group)) {
          if (key !== "_id")
            entry[key] = (entry[key] ?? 0) + expression(op.$sum, row, vars);
        }
        groups.set(id, entry);
      }
      rows = [...groups.values()];
    } else if (stage.$facet)
      rows = [
        Object.fromEntries(
          Object.entries(stage.$facet).map(([key, value]) => [
            key,
            evaluate(rows, value, collections, vars),
          ]),
        ),
      ];
    else throw new Error(`Unexpected stage ${Object.keys(stage)}`);
  }
  return rows;
}
export function memoryDatabase(collections) {
  return {
    collection(name) {
      const rows = collections[name] ?? (collections[name] = []);
      const mutate = (filter, update, options = {}) => {
        let row = rows.find((row) => matches(row, filter));
        if (!row && options.upsert) {
          row = { ...filter };
          rows.push(row);
        }
        if (!row) return null;
        Object.assign(row, update.$set);
        if (update.$inc)
          for (const [key, value] of Object.entries(update.$inc))
            row[key] = (row[key] ?? 0) + value;
        return row;
      };
      return {
        aggregate(pipeline, options) {
          assert.equal(options.maxTimeMS, 10000);
          return { toArray: async () => evaluate(rows, pipeline, collections) };
        },
        findOne: async (filter, options = {}) => {
          const row = rows.find((row) => matches(row, filter));
          return row
            ? options.projection
              ? project(row, options.projection)
              : row
            : null;
        },
        find(filter, options = {}) {
          let data = rows.filter((row) => matches(row, filter));
          const cursor = {
            sort: () => cursor,
            skip: (n) => {
              data = data.slice(n);
              return cursor;
            },
            limit: (n) => {
              data = data.slice(0, n);
              return cursor;
            },
            toArray: async () =>
              data.map((row) =>
                options.projection ? project(row, options.projection) : row,
              ),
          };
          return cursor;
        },
        insertOne: async (row) => {
          rows.push(row);
          return { insertedId: row._id };
        },
        findOneAndUpdate: async (filter, update, options) =>
          mutate(filter, update, options),
        updateOne: async (filter, update, options) => ({
          modifiedCount: mutate(filter, update, options) ? 1 : 0,
        }),
      };
    },
  };
}
