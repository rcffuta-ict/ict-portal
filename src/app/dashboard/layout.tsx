import { db } from "@/lib/db";
import { parsePalette } from "@/lib/palette";
import { ThemeStyle } from "@/components/layout/theme-style";
import { DashboardShell } from "@/components/layout/dashboard-shell";

/**
 * The members' dashboard wears the active session's palette, recorded at coronation.
 *
 * Only the palette is read here — no personal data, nothing that depends on who is
 * asking — so it is safe to resolve before the client shell has checked the session.
 * A missing, partial or malformed palette falls back to the brand (parsePalette → null).
 */
/**
 * The dashboard pages are static shells that fetch their data on the client, so this
 * layout is rendered ahead of time and cached. Every action that can change the active
 * palette (coronation, clearing it, handover, a new tenure) calls
 * revalidatePath("/dashboard", "layout"); the hourly revalidation is only a safety net.
 */
export const revalidate = 3600;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const palette = await activePalette();
    return (
        <>
            <ThemeStyle palette={palette} />
            <DashboardShell>{children}</DashboardShell>
        </>
    );
}

async function activePalette() {
    try {
        const { data } = await db
            .from("tenures")
            .select("theme_palette")
            .eq("is_active", true)
            .maybeSingle();
        return parsePalette(data?.theme_palette);
    } catch {
        // The palette is decoration. A failed read must never take the dashboard down.
        return null;
    }
}
