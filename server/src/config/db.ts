import { Db, MongoClient } from "mongodb";
import { env } from "./env.js";
import process from "node:process";

const client = new MongoClient(env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  maxPoolSize: 50,
  maxIdleTimeMS: 60000,
  waitQueueTimeoutMS: 10000,
});

let database: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (process.env.NGC_ISOLATED_TEST === "1")
    throw new Error("Database connections are disabled in isolated tests");
  if (database) return database;

  await client.connect();

  const db = client.db(env.DB_NAME);
  await db.command({ ping: 1 });

  database = db;

  console.log(`MongoDB connected: ${env.DB_NAME}`);

  return db;
}

export function getDB(): Db {
  if (!database) {
    throw new Error("MongoDB is not connected");
  }

  return database;
}

// Better Auth shares this exact connection pool with the member repository.
export function getMongoClient(): MongoClient {
  if (process.env.NGC_ISOLATED_TEST === "1")
    throw new Error("Database connections are disabled in isolated tests");
  return client;
}

export async function closeDB(): Promise<void> {
  await client.close();
  database = null;
}
