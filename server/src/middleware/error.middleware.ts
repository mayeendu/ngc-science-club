import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/app-error.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const parserType =
    typeof error === "object" && error !== null && "type" in error
      ? error.type
      : null;
  const statusCode =
    error instanceof AppError
      ? error.statusCode
      : parserType === "entity.parse.failed"
        ? 400
        : parserType === "entity.too.large"
          ? 413
          : 500;

  const message =
    error instanceof AppError
      ? error.message
      : statusCode === 400
        ? "Invalid JSON body"
        : statusCode === 413
          ? "Request body too large"
          : "Internal server error";

  // Driver/parser errors can contain URIs, cookies or a copy of the request body.
  console.error("API request failed", { statusCode });

  res.status(statusCode).json({
    success: false,
    message,
  });
};
