import { getDB } from "../../config/db.js";

export async function countMembers(): Promise<number> {
  const collection = getDB().collection("members");

  return collection.countDocuments();
}
