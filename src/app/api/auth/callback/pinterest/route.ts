// app/api/auth/callback/pinterest/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("pinterest_state")?.value;

  if (!state || state !== savedState) {
    console.error("State mismatch - possible CSRF attack");
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/error`);
  }

  if (!code) {
    console.error("Authorization code is missing from callback URL.");
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/error`);
  }

  const clientId = process.env.PINTEREST_CLIENT_ID;
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/pinterest`;

  try {
    // Using basic auth instead of client_secret in body
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const formData = new URLSearchParams();
    formData.append("grant_type", "authorization_code");
    formData.append("code", code);
    formData.append("redirect_uri", redirectUri);

    console.log("Sending token request with body:", formData.toString());

    const tokenResponse = await fetch(
      "https://api.pinterest.com/v5/oauth/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: formData,
      }
    );

    const tokenData = await tokenResponse.json();

    console.log("Token response status:", tokenResponse.status);
    console.log(
      "Token response headers:",
      Object.fromEntries(tokenResponse.headers)
    );
    console.log("Token response data:", tokenData);

    if (!tokenResponse.ok) {
      console.error("Error fetching token:", tokenData);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/error`);
    }

    await cookieStore.set("pinterest_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    await cookieStore.delete("pinterest_state");

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/user-boards`
    );
  } catch (error) {
    console.error("Error handling callback:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/error`);
  }
}
