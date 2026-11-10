import "dotenv/config";
import { z } from "zod";

const httpOrigin = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && url.origin === value;
}, "Use an HTTP(S) origin without a path, credentials, query, or trailing slash.");

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.coerce.number().int().min(1).max(65535).default(5000),

    CLIENT_URL: httpOrigin,

    MONGODB_URI: z.string().min(1),

    DB_NAME: z.string().min(1),

    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
  })
  .superRefine((values, context) => {
    if (values.NODE_ENV === "production") {
      for (const field of ["CLIENT_URL", "BETTER_AUTH_URL"] as const) {
        if (!values[field].startsWith("https://")) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: "HTTPS is required in production.",
          });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const fields = [
    ...new Set(parsed.error.issues.map((issue) => issue.path.join("."))),
  ];
  // Fail fast without including secret values or connection strings in errors.
  throw new Error(`Invalid server environment settings: ${fields.join(", ")}`);
}
export const env = parsed.data;
