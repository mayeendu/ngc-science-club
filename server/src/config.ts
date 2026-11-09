import "dotenv/config";

const port = Number(process.env.PORT ?? "4000");

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
const parsedOrigin = new URL(clientOrigin);

if (
  !["http:", "https:"].includes(parsedOrigin.protocol) ||
  parsedOrigin.origin !== clientOrigin
) {
  throw new Error(
    "CLIENT_ORIGIN must be an HTTP(S) origin without a path or trailing slash.",
  );
}

export const config = { port, clientOrigin };
