import cors from "cors";
import express from "express";
import { config } from "./config.js";

export const app = express();

app.disable("x-powered-by");
app.use(
  cors({
    origin: config.clientOrigin,
    methods: ["GET"],
  }),
);

app.get("/api/health", (_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    status: "ok",
    service: "ngc-science-club-api",
    message: "NGC Science Club API is running.",
  });
});

app.use((_request, response) => {
  response.status(404).json({
    error: { code: "NOT_FOUND", message: "Route not found." },
  });
});
