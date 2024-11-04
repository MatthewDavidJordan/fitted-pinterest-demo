// app/api/auth/pinterest/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET() {
  const clientId = process.env.PINTEREST_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/pinterest`;

  // Generate and store state parameter
  const state = crypto.randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("pinterest_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
  });

  const authUrl = new URL("https://www.pinterest.com/oauth/");
  authUrl.searchParams.append("client_id", clientId!);
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("response_type", "code");
  // Add both boards:read and pins:read scopes
  authUrl.searchParams.append("scope", "boards:read,pins:read");
  authUrl.searchParams.append("state", state);

  return NextResponse.redirect(authUrl.toString());
}
