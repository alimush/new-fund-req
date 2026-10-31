// lib/mongodb.js
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("❌ Please define MONGODB_URI in .env.local");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, listenersBound: false };
}

function resetCache() {
  cached.conn = null;
  cached.promise = null;
}

function bindConnectionListeners() {
  if (cached.listenersBound) return;
  cached.listenersBound = true;

  mongoose.connection.on("disconnected", () => {
    resetCache();
  });

  mongoose.connection.on("error", () => {
    resetCache();
  });
}

function isTransientTlsError(err) {
  const msg = String(err?.message || err || "");
  return (
    /ssl|tls|alert number 80|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|server selection|topology was destroyed|connection.*closed/i.test(
      msg
    )
  );
}

async function connectOnce() {
  bindConnectionListeners();

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        // تجنّب مسار IPv6 المتقطع اللي يسبب TLS alert 80
        family: 4,
        serverSelectionTimeoutMS: 12000,
        connectTimeoutMS: 12000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      })
      .then((m) => m)
      .catch((err) => {
        resetCache();
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    resetCache();
    throw err;
  }
}

async function dbConnect() {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await connectOnce();
    } catch (err) {
      lastErr = err;
      resetCache();
      if (!isTransientTlsError(err) || attempt === 3) break;
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
  throw lastErr;
}

export default dbConnect;
