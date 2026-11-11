import { z } from "zod";
import { clubRequest, clubJson, ClubApiError } from "./club-api";
export const resourceCategories = [
  "Zoology",
  "Botany",
  "Physics",
  "Chemistry",
  "Mathematics",
  "ICT",
] as const;
export const resourceFormats = ["pdf", "note", "presentation", "link"] as const;
export const resourceFormSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(10).max(3000),
    category: z.enum(resourceCategories),
    format: z.enum(resourceFormats),
    url: z.union([
      z.literal(""),
      z
        .url()
        .max(2048)
        .refine((value) => {
          if (!URL.canParse(value)) return false;
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        }),
    ]),
  })
  .refine(
    (value) => (value.format === "link" ? !!value.url : value.url === ""),
    {
      path: ["url"],
      message: "Only external-link resources require an HTTPS URL.",
    },
  );
const resource = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(resourceCategories),
  format: z.enum(resourceFormats),
  url: z.string(),
  updatedAt: z.iso.datetime(),
  file: z
    .object({ name: z.string(), mime: z.string(), size: z.number() })
    .nullable(),
  version: z.number().optional(),
  published: z.boolean().optional(),
});
export type Resource = z.infer<typeof resource>;
export type ResourceInput = z.infer<typeof resourceFormSchema>;
export function listResources(
  staff: boolean,
  page: number,
  category: string,
  q: string,
  signal: AbortSignal,
) {
  return clubRequest(
    `${staff ? "manage/" : ""}resources?${new URLSearchParams({ page: String(page), q, ...(category ? { category } : {}) })}`,
    z.object({
      success: z.literal(true),
      items: z.array(resource),
      page: z.number(),
      hasNext: z.boolean(),
    }),
    { signal },
  );
}
export function saveResource(input: ResourceInput, current?: Resource) {
  return clubRequest(
    `manage/resources${current ? `/${current.id}` : ""}`,
    z.object({ success: z.literal(true), resource }),
    clubJson(current ? "PUT" : "POST", {
      ...input,
      ...(current ? { version: current.version } : {}),
    }),
  );
}
export function resourceAction(current: Resource, published?: boolean) {
  return clubRequest(
    `manage/resources/${current.id}${published === undefined ? "" : "/status"}`,
    z.object({ success: z.literal(true) }),
    clubJson(published === undefined ? "DELETE" : "PATCH", {
      version: current.version,
      ...(published === undefined ? {} : { published }),
    }),
  );
}
export function uploadResource(current: Resource, file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new ClubApiError(400);
  return clubRequest(
    `manage/resources/${current.id}/file`,
    z.object({ success: z.literal(true), resource }),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        "X-Resource-Version": String(current.version),
      },
      body: file,
    },
  );
}
export async function downloadResource(current: Resource, staff: boolean) {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) throw new ClubApiError(500);
  const response = await fetch(
    `${base.replace(/\/$/, "")}/api/${staff ? "manage/" : ""}resources/${current.id}/download`,
    {
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok) throw new ClubApiError(response.status);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = current.file?.name ?? "resource";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
