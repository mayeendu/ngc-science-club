
import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:3000";

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "NGC Science Club API is running!",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(
    `NGC Science Club API running at http://localhost:${PORT}`
  );
});
