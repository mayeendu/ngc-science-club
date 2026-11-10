import { Db, MongoClient } from "mongodb";
import { env } from "./env.js";

const client = new MongoClient(env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
});

let database: Db | null = null;

export async function connectDB(): Promise<Db> {
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
  return client;
}

export async function closeDB(): Promise<void> {
  await client.close();
  database = null;
}
