import { z } from "zod";
export const showcaseId = z.string().regex(/^[a-f0-9]{24}$/);
export const showcaseContent = z
  .strictObject({
    kind: z.enum(["achievement", "gallery"]),
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(10).max(3000),
    occurredOn: z.iso
      .date()
      .refine(
        (value) =>
          value >= "2000-01-01" &&
          value <= new Date().toISOString().slice(0, 10),
      ),
    image: z.union([
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
    published: z.boolean(),
  })
  .refine(
    (value) => value.kind !== "gallery" || !!value.image,
    "Gallery entries require an HTTPS image.",
  );
export const showcaseVersion = z.strictObject({
  version: z.number().int().positive(),
});
export const showcaseUpdate = z
  .strictObject({
    ...showcaseContent.shape,
    version: z.number().int().positive(),
  })
  .refine((value) => value.kind !== "gallery" || !!value.image);
export const showcaseQuery = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  kind: z.enum(["achievement", "gallery"]).optional(),
});
