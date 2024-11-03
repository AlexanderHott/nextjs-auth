import type { /* User, */ Session } from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { env } from "./env";
import { cache } from "react";

const SESSION_TOKEN_LENGTH = 20;
const SESSION_EXPIRES_AFTER = 1000 * 60 * 60 * 24 * 30;
const SESSION_EXTEND_BEFORE = 1000 * 60 * 60 * 24 * 15;

export function generateSessionToken() {
  const bytes = new Uint8Array(SESSION_TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  const token = encodeBase32LowerCaseNoPadding(bytes);
  return token;
}

export async function createSession(token: string, userId: number) {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + SESSION_EXPIRES_AFTER), // 30 days
  };
  await db.insert(schema.sessions).values(session);
  return session;
}

export async function validateSessionToken(token: string) {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  // const result2 = await db.query.sessions.findFirst({where: eq(schema.sessions.userId, schema.users.id)})
  const result = await db
    .select({ user: schema.users, session: schema.sessions })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.id, sessionId));
  if (result.length < 1 || result[0] === undefined) {
    // no session
    return { session: null, user: null };
  }
  const { user, session } = result[0];
  if (Date.now() >= session.expiresAt.getTime()) {
    // session expired
    await db.delete(schema.sessions).where(eq(schema.sessions.id, session.id));
    return { session: null, user: null };
  }
  if (Date.now() >= session.expiresAt.getTime() - SESSION_EXTEND_BEFORE) {
    // extend session if it will expire in less than 15 days
    session.expiresAt = new Date(Date.now() + SESSION_EXPIRES_AFTER);
    await db
      .update(schema.sessions)
      .set({
        expiresAt: session.expiresAt,
      })
      .where(eq(schema.sessions.id, session.id));
  }
  return { session, user };
}

export async function invalidateSession(sessionId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function setSessionTokenCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSessionTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}
export const getCurrentSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value ?? null;
  if (token === null) {
    return { session: null, user: null };
  }
  const result = await validateSessionToken(token);
  return result;
});

// export type SessionValidationResult =
//   | { session: Session; user: User }
//   | { session: null; user: null };
