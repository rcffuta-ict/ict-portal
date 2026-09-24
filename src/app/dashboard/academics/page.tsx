import type { Metadata } from "next";
import { BookOpen, ShieldAlert } from "lucide-react";
import { getAcademicsHomeAction } from "./actions";
import { AcademicsWorkspace } from "./components/academics-workspace";

export const metadata: Metadata = {
    title: "Academics",
    description: "Members' semester results, analytics, results rounds and departments.",
};

/**
 * Academics module. Read-gated by the `academics` module config (the Academic Coord by
 * default), server-side here and again in every action. The tab comes from `?tab=`.
 */
export default async function AcademicsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const [data, { tab }] = await Promise.all([getAcademicsHomeAction(), searchParams]);

    if (!data.authorized) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                <ShieldAlert className="h-10 w-10 text-amber-500" />
                <h1 className="text-lg font-bold text-rcf-navy">Restricted area</h1>
                <p className="text-sm text-gray-600">You don&apos;t have access to the Academics module.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start gap-3 border-b border-slate-200 pb-6">
                <div className="inline-flex rounded-lg bg-rcf-navy p-3 text-white">
                    <BookOpen className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-rcf-navy">Academics</h1>
                    <p className="text-sm text-gray-500">
                        Members&apos; semester results, collected in rounds.
                        {!data.canWrite && " You can view; changes are made by the Academic Unit."}
                    </p>
                </div>
            </header>

            <AcademicsWorkspace
                canWrite={data.canWrite}
                rounds={data.rounds}
                settings={data.settings}
                activeSession={data.activeSession}
                initialTab={tab}
            />
        </div>
    );
}
