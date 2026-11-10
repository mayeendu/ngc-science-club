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
  const statusCode = error instanceof AppError ? error.statusCode : 500;

  const message =
    error instanceof AppError ? error.message : "Internal server error";

  console.error("API error:", error);

  res.status(statusCode).json({
    success: false,
    message,
  });
};
