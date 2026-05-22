import { createMiddleware } from "hono/factory";
import { SignJWT, jwtVerify } from "jose";
import { AuthError } from "../lib/errors.js";

const getSecret = () => {
  const secret = process.env["JWT_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
};

// ── Token utilities ────────────────────────────────────────────────────────
export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) throw new AuthError("Invalid token payload");
    return payload.sub;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("Invalid or expired token. Please log in again.");
  }
}

// ── Hono type augmentation — makes c.get("userId") type-safe ──────────────
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
  }
}

// ── Middleware ─────────────────────────────────────────────────────────────
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Authorization header must be: Bearer <token>");
  }

  const token = authHeader.slice(7).trim();
  if (!token) throw new AuthError("Token missing from Authorization header");

  const userId = await verifyToken(token);
  c.set("userId", userId);
  await next();
});