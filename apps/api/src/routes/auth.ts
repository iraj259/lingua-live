import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { signToken } from "../middleware/auth.js";
import { ConflictError, AuthError, AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const authRouter = new Hono();

const registerSchema = z.object({
  email:       z.string().email().toLowerCase().trim(),
  password:    z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2).max(50).trim(),
});

const loginSchema = z.object({
  email:    z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

// ── POST /auth/register ────────────────────────────────────────────────────
authRouter.post(
  "/register",
  zValidator("json", registerSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        issues: result.error.issues.map(i => ({
          field: i.path.join("."),
          message: i.message,
        })),
      }, 422);
    }
    return undefined;
  }),
  async (c) => {
    const { email, password, displayName } = c.req.valid("json");

    const existing = await db.select({ id: users.id })
      .from(users).where(eq(users.email, email)).limit(1);

    if (existing.length > 0) {
      throw new ConflictError("An account with this email already exists. Please log in.");
    }

    const passwordHash = await hash(password, 12);

    const [newUser] = await db.insert(users)
      .values({ email, passwordHash, displayName })
      .returning({ id: users.id, email: users.email, displayName: users.displayName, createdAt: users.createdAt });

    if (!newUser) throw new AppError("Failed to create account", 500);

    const token = await signToken(newUser.id);
    logger.info("User registered", { userId: newUser.id });

    return c.json({ token, user: newUser }, 201);
  }
);

// ── POST /auth/login ───────────────────────────────────────────────────────
authRouter.post(
  "/login",
  zValidator("json", loginSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid email or password format", code: "VALIDATION_ERROR" }, 422);
    }
    return undefined;
  }),
  async (c) => {
    const { email, password } = c.req.valid("json");

    const [user] = await db.select().from(users)
      .where(eq(users.email, email)).limit(1);

    // Timing-safe: always run bcrypt even if user not found
    // to prevent user enumeration via response time
    const DUMMY = "$2b$12$dummy.hash.to.prevent.timing.attacks.xxxxxx";
    const isValid = await compare(password, user?.passwordHash ?? DUMMY);

    if (!user || !isValid) {
      await new Promise(r => setTimeout(r, 200)); // slow down brute force
      throw new AuthError("Invalid email or password");
    }

    const token = await signToken(user.id);
    logger.info("User logged in", { userId: user.id });

    return c.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt },
    });
  }
);

// ── GET /auth/me ───────────────────────────────────────────────────────────
// Frontend calls this on load to validate a stored token
authRouter.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new AuthError();

  const { verifyToken } = await import("../middleware/auth.js");
  const userId = await verifyToken(authHeader.slice(7));

  const [user] = await db.select({
    id: users.id, email: users.email,
    displayName: users.displayName, createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!user) throw new AuthError("Account not found");
  return c.json({ user });
});