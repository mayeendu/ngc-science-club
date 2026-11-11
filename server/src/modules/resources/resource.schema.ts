import { z } from "zod";
export const resourceId = z.string().regex(/^[a-f0-9]{24}$/);
export const resourceCategory = z.enum([
  "Zoology",
  "Botany",
  "Physics",
  "Chemistry",
  "Mathematics",
  "ICT",
]);
export const resourceContent = z
  .strictObject({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(10).max(3000),
    category: resourceCategory,
    format: z.enum(["pdf", "note", "presentation", "link"]),
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
    "Only external-link resources require an HTTPS URL.",
  );
export const resourceUpdate = z
  .strictObject({
    ...resourceContent.shape,
    version: z.number().int().positive(),
  })
  .refine((value) =>
    value.format === "link" ? !!value.url : value.url === "",
  );
export const resourceVersion = z.strictObject({
  version: z.number().int().positive(),
});
export const resourceStatus = resourceVersion.extend({
  published: z.boolean(),
});
export const resourceQuery = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  category: resourceCategory.optional(),
  q: z.string().trim().max(100).default(""),
});
export type ResourceActor = {
  id: string;
  role: "student" | "teacher" | "admin";
};
