import mongoose from "mongoose";
import { getEnv } from "@/shared/config/env";

/** Tuned for a single Next.js process on VPS (PM2/systemd, instances: 1). */
export const MONGOOSE_CLIENT_OPTIONS = {
  bufferCommands: false,
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
} as const;

declare global {
  // eslint-disable-next-line no-var
  var __mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
    listenersRegistered: boolean;
  } | undefined;
  // eslint-disable-next-line no-var
  var __mongooseShutdownRegistered: boolean | undefined;
}

function getMongooseCache() {
  if (!global.__mongoose) {
    global.__mongoose = { conn: null, promise: null, listenersRegistered: false };
  }
  return global.__mongoose;
}

function registerConnectionListeners() {
  const cache = getMongooseCache();
  if (cache.listenersRegistered) return;
  cache.listenersRegistered = true;

  mongoose.connection.on("disconnected", () => {
    cache.conn = null;
    cache.promise = null;
  });
}

function registerGracefulShutdown() {
  if (global.__mongooseShutdownRegistered) return;
  global.__mongooseShutdownRegistered = true;

  const close = () => {
    void mongoose.disconnect().catch(() => undefined);
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

export async function connectDb() {
  const cache = getMongooseCache();

  if (cache.conn?.connection.readyState === 1) {
    return cache.conn;
  }

  if (!cache.promise) {
    registerConnectionListeners();
    registerGracefulShutdown();

    const { MONGODB_URI } = getEnv();
    cache.promise = mongoose.connect(MONGODB_URI, MONGOOSE_CLIENT_OPTIONS).then((conn) => {
      cache.conn = conn;
      return conn;
    });
  }

  try {
    return await cache.promise;
  } catch (error) {
    cache.promise = null;
    cache.conn = null;
    throw error;
  }
}
