import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminClient } from "@/src/lib/supabase/server";
import OracleController from "@/src/components/OracleController";

export default async function OracleControllerPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("sb-access-token")?.value;

    if (!token) redirect("/login");

    const supabase = getAdminClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser(token);
    if (error || !user?.email) {
        // Route handler clears cookies (can't do it from a page server component)
        redirect("/api/auth/logout");
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase());

    if (!adminEmails.includes(user!.email!.toLowerCase())) {
        redirect("/");
    }

    return <OracleController />;
}
