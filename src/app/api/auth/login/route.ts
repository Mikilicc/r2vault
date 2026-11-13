import { NextResponse } from "next/server";
import { isCorrectPassword, isSameOrigin, SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Nevažeći zahtev." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nevažeći zahtev." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("password" in body) ||
    typeof body.password !== "string" ||
    body.password.length > 256
  ) {
    return NextResponse.json({ error: "Unesi ispravnu lozinku." }, { status: 400 });
  }

  try {
    if (!isCorrectPassword(body.password)) {
      return NextResponse.json({ error: "Lozinka nije ispravna." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
      priority: "high",
    });
    return response;
  } catch (error) {
    console.error("Login configuration error:", error);
    return NextResponse.json({ error: "Prijava trenutno nije dostupna." }, { status: 503 });
  }
}
