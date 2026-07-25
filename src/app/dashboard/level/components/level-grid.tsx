/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { GraduationCap, Users, Mars, Venus, Eye, ShieldCheck } from "lucide-react";

/**
 * Grid of generation cards. Each card links to the generation's own page
 * (/dashboard/level/[classSetId]) — no modal.
 */
export function LevelGrid({ generations }: { generations: any[] }) {
    if (!generations || generations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-center">
                <GraduationCap className="h-10 w-10 mb-3 text-slate-300" />
                <h3 className="font-bold text-slate-800">No generations to manage</h3>
                <p className="max-w-sm text-sm text-slate-500 mt-1">
                    You&apos;re not assigned to coordinate any level yet.
                </p>
            </div>
        );
    }

    return (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {generations.map((g: any) => (
                <Link
                    key={g.classSetId}
                    href={`/dashboard/level/${g.classSetId}`}
                    className="group text-left bg-white p-6 rounded-2xl border border-slate-200 hover:border-rcf-navy/30 hover:shadow-lg transition-all relative overflow-hidden"
                >
                    <div className="absolute -right-4 -top-4 text-slate-50 group-hover:text-emerald-50 transition-colors">
                        <GraduationCap className="h-24 w-24" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 w-fit mb-4">
                                <GraduationCap className="h-6 w-6" />
                            </div>
                            <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                                    g.canWrite ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                                }`}
                            >
                                {g.canWrite ? <ShieldCheck className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                {g.canWrite ? "Coordinator" : "View only"}
                            </span>
                        </div>
                        <h3 className="font-bold text-xl text-slate-900">
                            {g.familyName || "Unnamed Generation"}
                        </h3>
                        <p className="text-xs font-bold text-rcf-navy uppercase tracking-wide opacity-80 mt-1">
                            {g.level || "—"} · {g.entryYear} Set
                        </p>
                        <div className="mt-5 flex items-center gap-4 text-sm">
                            <span className="inline-flex items-center gap-1 text-sky-600 font-medium">
                                <Mars className="h-4 w-4" /> {g.stats?.male ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1 text-pink-600 font-medium">
                                <Venus className="h-4 w-4" /> {g.stats?.female ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1 text-slate-900 font-bold ml-auto">
                                <Users className="h-4 w-4 text-slate-400" /> {g.stats?.total ?? 0}
                            </span>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
