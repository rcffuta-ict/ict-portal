import { GraduationCap, ShieldAlert } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { requireModuleRead } from "@/lib/access-control";

/**
 * Level module — read-gated placeholder for the foundation pass. The full member-
 * management build (invite links, member detail) lands in a later phase. Access is
 * still enforced now (module read config) so the route is correctly scoped from day one.
 */
export default async function LevelPage() {
    try {
        await requireModuleRead("level");
    } catch {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                <ShieldAlert className="h-10 w-10 text-amber-500" />
                <h1 className="text-lg font-bold text-rcf-navy">Restricted area</h1>
                <p className="text-sm text-gray-600">
                    You don&apos;t have access to the Level module.
                </p>
            </div>
        );
    }

    return (
        <ComingSoon
            icon={GraduationCap}
            title="Levels"
            description="Level member management is coming soon."
        />
    );
}
