import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, broadcastOracleEvent } from "@/src/lib/supabase/server";

async function verifyAdmin(request: NextRequest) {
    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase());
    const token = request.cookies.get("sb-access-token")?.value;
    if (!token) return false;
    const supabase = getAdminClient();
    const { data: { user } } = await supabase.auth.getUser(token);
    return adminEmails.includes(user?.email?.toLowerCase() ?? "");
}

export async function POST(request: NextRequest) {
    if (!(await verifyAdmin(request)))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await broadcastOracleEvent("reset", {});
    return NextResponse.json({ success: true });
}
