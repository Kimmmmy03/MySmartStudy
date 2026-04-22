import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { token, role } = await req.json();

  const res = NextResponse.json({ ok: true });

  if (token && role) {
    // Firebase Hosting's CDN strips every Set-Cookie header whose name is not
    // exactly `__session`. We pack role + active flag into that single cookie
    // as JSON so middleware can still enforce role-based routing.
    res.cookies.set("__session", JSON.stringify({ active: 1, role }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  } else {
    res.cookies.delete("__session");
  }

  return res;
}
