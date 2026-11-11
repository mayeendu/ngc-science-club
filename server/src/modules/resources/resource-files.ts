import { GridFSBucket, type ObjectId } from "mongodb";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash, randomUUID } from "node:crypto";
import { getDB } from "../../config/db.js";
import { AppError } from "../../utils/app-error.js";
export const MAX_RESOURCE_SIZE = 5 * 1024 * 1024;
export function validateResourceFile(
  bytes: Buffer,
  name: string,
  format: string,
) {
  if (
    !bytes.length ||
    bytes.length > MAX_RESOURCE_SIZE ||
    name.length > 150 ||
    Array.from(name).some(
      (character) =>
        character.charCodeAt(0) < 32 ||
        character.charCodeAt(0) === 127 ||
        character === "/" ||
        character === "\\",
    )
  )
    throw new AppError(400, "Invalid file name or size (maximum 5 MiB).");
  const extension = name.split(".").at(-1)?.toLowerCase();
  let mime: string;
  if (
    extension === "pdf" &&
    ["pdf", "note", "presentation"].includes(format) &&
    /^%PDF-(1\.[0-7]|2\.0)/.test(bytes.subarray(0, 8).toString()) &&
    bytes.subarray(-1024).includes(Buffer.from("%%EOF"))
  )
    mime = "application/pdf";
  else if (extension === "txt" && format === "note") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new AppError(400, "Notes must use valid UTF-8 text.");
    }
    if (bytes.includes(0))
      throw new AppError(400, "Binary data is not a text note.");
    mime = "text/plain; charset=utf-8";
  } else if (
    extension === "pptx" &&
    format === "presentation" &&
    bytes.length >= 22 &&
    bytes.readUInt32LE(0) === 0x04034b50
  ) {
    // Inspect the ZIP directory without unpacking or executing document content.
    let end = -1;
    for (
      let offset = bytes.length - 22;
      offset >= Math.max(0, bytes.length - 65557);
      offset--
    )
      if (bytes.readUInt32LE(offset) === 0x06054b50) {
        end = offset;
        break;
      }
    if (
      end < 0 ||
      bytes.readUInt16LE(end + 4) ||
      bytes.readUInt16LE(end + 6) ||
      end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length
    )
      throw new AppError(400, "Invalid presentation archive.");
    const count = bytes.readUInt16LE(end + 10),
      length = bytes.readUInt32LE(end + 12),
      start = bytes.readUInt32LE(end + 16);
    if (!count || count > 10000 || start + length !== end)
      throw new AppError(400, "Invalid presentation directory.");
    const names = new Set<string>();
    let offset = start,
      expanded = 0;
    for (let i = 0; i < count; i++) {
      if (
        offset + 46 > end ||
        bytes.readUInt32LE(offset) !== 0x02014b50 ||
        bytes.readUInt16LE(offset + 8) & 1
      )
        throw new AppError(
          400,
          "Encrypted or invalid presentations are unsupported.",
        );
      const nameLength = bytes.readUInt16LE(offset + 28),
        extra = bytes.readUInt16LE(offset + 30),
        comment = bytes.readUInt16LE(offset + 32),
        next = offset + 46 + nameLength + extra + comment;
      if (next > end) throw new AppError(400, "Invalid presentation entry.");
      const entry = bytes
        .subarray(offset + 46, offset + 46 + nameLength)
        .toString("utf8");
      if (
        entry.startsWith("/") ||
        entry.includes("\\") ||
        entry.split("/").includes("..") ||
        /vbaProject|\.(exe|dll|bin)$/i.test(entry) ||
        names.has(entry)
      )
        throw new AppError(400, "Unsafe presentation entry.");
      expanded += bytes.readUInt32LE(offset + 24);
      if (expanded > 50 * 1024 * 1024)
        throw new AppError(400, "Expanded presentation exceeds 50 MiB.");
      names.add(entry);
      offset = next;
    }
    if (
      offset !== end ||
      !names.has("[Content_Types].xml") ||
      !names.has("ppt/presentation.xml")
    )
      throw new AppError(400, "Upload a valid PPTX presentation.");
    mime =
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  } else
    throw new AppError(
      400,
      "Use a matching PDF, UTF-8 TXT note or non-macro PPTX presentation.",
    );
  return {
    name,
    mime,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
export interface ResourceStorage {
  upload(bytes: Buffer): Promise<ObjectId>;
  remove(id: ObjectId): Promise<void>;
  download(id: ObjectId): Readable;
}
export const gridResourceStorage: ResourceStorage = {
  async upload(bytes) {
    const bucket = new GridFSBucket(getDB(), { bucketName: "resourceFiles" });
    const stream = bucket.openUploadStream(randomUUID());
    try {
      await pipeline(Readable.from([bytes]), stream);
      return stream.id;
    } catch (error) {
      await bucket.delete(stream.id).catch(() => undefined);
      throw error;
    }
  },
  remove: (id) =>
    new GridFSBucket(getDB(), { bucketName: "resourceFiles" }).delete(id),
  download: (id) =>
    new GridFSBucket(getDB(), {
      bucketName: "resourceFiles",
    }).openDownloadStream(id),
};
