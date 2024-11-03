import {
  generateSessionToken,
  createSession,
  setSessionTokenCookie,
  github,
} from "@/auth";
import { cookies } from "next/headers";
import * as schema from "@/server/db/schema";

import type { OAuth2Tokens } from "arctic";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get("github_oauth_state")?.value ?? null;
  if (code === null || state === null || storedState === null) {
    return new Response(null, {
      status: 400,
    });
  }
  if (state !== storedState) {
    return new Response(null, {
      status: 400,
    });
  }

  let tokens: OAuth2Tokens;
  try {
    tokens = await github.validateAuthorizationCode(code);
  } catch (e) {
    // Invalid code or client credentials
    return new Response(null, {
      status: 400,
    });
  }
  const githubUserResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokens.accessToken()}`,
    },
  });
  const githubUser = (await githubUserResponse.json()) as {
    id: number;
    login: string;
  };
  const githubUserId = githubUser.id;
  const githubUsername = githubUser.login;

  // TODO: Replace this with your own DB query.

  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.githubId, githubUserId),
  });

  if (existingUser) {
    const sessionToken = generateSessionToken();
    const session = await createSession(sessionToken, existingUser.id);
    await setSessionTokenCookie(sessionToken, session.expiresAt);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
      },
    });
  }

  // TODO: Replace this with your own DB query.
  const user = (
    await db
      .insert(schema.users)
      .values({ githubId: githubUserId, username: githubUsername })
      .returning()
  )[0]!;

  const sessionToken = generateSessionToken();
  const session = await createSession(sessionToken, user.id);
  await setSessionTokenCookie(sessionToken, session.expiresAt);
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
    },
  });
}
