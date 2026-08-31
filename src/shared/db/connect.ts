import mongoose from "mongoose";
import { getEnv } from "@/shared/config/env";

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: typeof mongoose | undefined;
}

export async function connectDb() {
  if (global.__mongooseConn?.connection.readyState === 1) {
    return global.__mongooseConn;
  }

  const { MONGODB_URI } = getEnv();
  const conn = await mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    maxPoolSize: 12,
    minPoolSize: 1,
  });

  global.__mongooseConn = conn;
  return conn;
}
