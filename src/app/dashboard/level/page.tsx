import { ShieldAlert, GraduationCap } from "lucide-react";
import { getLevelModuleData } from "./actions";
import { LevelGrid } from "./components/level-grid";

/**
 * Level module — level (generation) member management. Read-gated by the
 * `module_access` "level" config (server-side); CENTRAL/admins see every generation,
 * a LEVEL coordinator sees only the one(s) they oversee. Each generation opens on its
 * own page (/dashboard/level/[classSetId]).
 */
export default async function LevelPage() {
    const data = await getLevelModuleData();

    if (!data.authorized) {
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
        <div className="space-y-6">
            <header className="flex items-start gap-3 border-b border-slate-200 pb-6">
                <div className="inline-flex rounded-lg bg-rcf-navy p-3 text-white">
                    <GraduationCap className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-rcf-navy">Levels</h1>
                    <p className="text-sm text-gray-500">
                        {data.seesAll
                            ? "All generations. Open one to view its members and details."
                            : "Your generation(s). Share registration links and manage members."}
                    </p>
                </div>
            </header>

            <LevelGrid generations={data.generations || []} />
        </div>
    );
}
