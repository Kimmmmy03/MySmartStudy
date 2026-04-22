import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/api/"];

function readSession(raw: string | undefined): { active: boolean; role: string | null } {
  if (!raw) return { active: false, role: null };
  try {
    const parsed = JSON.parse(raw);
    return { active: !!parsed?.active, role: typeof parsed?.role === "string" ? parsed.role : null };
  } catch {
    return { active: false, role: null };
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow homepage
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const { active, role } = readSession(request.cookies.get("__session")?.value);

  // Redirect unauthenticated users to login
  if (!active) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route protection
  if (role) {
    if (pathname.startsWith("/student") && role !== "student" && role !== "admin") {
      const dest = role === "lecturer" ? "/lecturer/dashboard" : "/login";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    if (pathname.startsWith("/lecturer") && role !== "lecturer" && role !== "admin") {
      const dest = role === "student" ? "/student/dashboard" : "/login";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    if (pathname.startsWith("/admin") && role !== "admin") {
      const dest = role === "lecturer" ? "/lecturer/dashboard" : role === "student" ? "/student/dashboard" : "/admin/dashboard";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
