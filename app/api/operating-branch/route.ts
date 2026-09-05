import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentStaff, operatingBranchCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  let branchId: string | null;

  try {
    const body = await request.json() as { branchId?: unknown };
    branchId = body.branchId === null ? null : typeof body.branchId === "string" ? body.branchId : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (branchId !== null && !staff.branchIds.includes(branchId)) {
    return NextResponse.json({ error: "Branch is not available to this account." }, { status: 403 });
  }

  const cookieStore = await cookies();
  if (branchId) {
    cookieStore.set(operatingBranchCookie, branchId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      priority: "medium",
    });
  } else {
    cookieStore.delete(operatingBranchCookie);
  }

  return NextResponse.json({ branchId });
}
