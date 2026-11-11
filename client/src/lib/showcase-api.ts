import { z } from "zod";
import { clubJson, clubRequest } from "./club-api";
export const showcaseFormSchema = z
  .object({
    kind: z.enum(["achievement", "gallery"]),
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(10).max(3000),
    occurredOn: z.iso.date(),
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
  .refine((value) => value.kind !== "gallery" || !!value.image, {
    path: ["image"],
    message: "Gallery entries require an HTTPS image.",
  });
const item = z.object({
  ...showcaseFormSchema.shape,
  id: z.string(),
  version: z.number().optional(),
  published: z.boolean().optional(),
});
export type ShowcaseItem = z.infer<typeof item>;
export type ShowcaseInput = z.infer<typeof showcaseFormSchema>;
export function listShowcase(
  staff: boolean,
  page: number,
  kind: string,
  signal: AbortSignal,
) {
  return clubRequest(
    `${staff ? "manage/" : ""}showcase?${new URLSearchParams({ page: String(page), ...(kind ? { kind } : {}) })}`,
    z.object({
      success: z.literal(true),
      items: z.array(item),
      page: z.number(),
      hasNext: z.boolean(),
    }),
    { signal },
  );
}
export function saveShowcase(input: ShowcaseInput, current?: ShowcaseItem) {
  return clubRequest(
    `manage/showcase${current ? `/${current.id}` : ""}`,
    z.object({ success: z.literal(true), item }),
    clubJson(current ? "PUT" : "POST", {
      ...input,
      ...(current ? { version: current.version } : {}),
    }),
  );
}
export function archiveShowcase(current: ShowcaseItem) {
  return clubRequest(
    `manage/showcase/${current.id}`,
    z.object({ success: z.literal(true) }),
    clubJson("DELETE", { version: current.version }),
  );
}
const certificate = z.object({
  revoked: z.boolean(),
  verificationId: z.string(),
  recipientName: z.string(),
  eventTitle: z.string(),
  eventDate: z.iso.datetime(),
  issuedAt: z.iso.datetime(),
  version: z.number(),
  valid: z.boolean(),
});
export type Certificate = z.infer<typeof certificate>;
export function listCertificates(
  staff: boolean,
  page: number,
  signal: AbortSignal,
) {
  return clubRequest(
    `${staff ? "manage" : "own"}/certificates?page=${page}`,
    z.object({
      success: z.literal(true),
      items: z.array(certificate),
      page: z.number(),
      hasNext: z.boolean(),
    }),
    { signal },
  );
}
export function issueCertificate(eventId: string, registrationId: string) {
  return clubRequest(
    "manage/certificates",
    z.object({ success: z.literal(true), certificate }),
    clubJson("POST", { eventId, registrationId }),
  );
}
export function revokeCertificate(current: Certificate) {
  return clubRequest(
    `manage/certificates/${current.verificationId}/revoke`,
    z.object({ success: z.literal(true) }),
    clubJson("PATCH", { version: current.version }),
  );
}
export function verifyCertificate(token: string, signal: AbortSignal) {
  return clubRequest(
    `certificates/verify/${encodeURIComponent(token)}`,
    z.object({
      success: z.literal(true),
      certificate: z.object({
        verificationId: z.string(),
        eventTitle: z.string(),
        eventDate: z.iso.datetime(),
        issuedAt: z.iso.datetime(),
        recipientInitials: z.string(),
        valid: z.boolean(),
      }),
    }),
    { signal },
  );
}
