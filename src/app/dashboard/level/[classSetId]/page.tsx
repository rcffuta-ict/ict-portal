import { ShieldAlert } from "lucide-react";
import { getGenerationAction } from "../actions";
import { GenerationDetail } from "../components/generation-detail";
import { Breadcrumb } from "../components/breadcrumb";

/**
 * A single generation's page (members + registration links) — replaces the old modal.
 */
export default async function GenerationPage({
    params,
}: {
    params: Promise<{ classSetId: string }>;
}) {
    const { classSetId } = await params;
    const res = await getGenerationAction(classSetId);

    if (!res.authorized || !res.generation) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                <ShieldAlert className="h-10 w-10 text-amber-500" />
                <h1 className="text-lg font-bold text-rcf-navy">Restricted area</h1>
                <p className="text-sm text-gray-600">
                    You don&apos;t have access to this generation.
                </p>
            </div>
        );
    }

    const g = res.generation;

    return (
        <div className="space-y-6">
            <Breadcrumb
                items={[
                    { label: "Levels", href: "/dashboard/level" },
                    { label: g.familyName || "Generation" },
                ]}
            />

            <header className="flex flex-col gap-1 border-b border-slate-200 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-rcf-navy">
                    {g.familyName || "Unnamed Generation"}
                </h1>
                <p className="text-sm text-slate-500">
                    {g.level || "—"} · {g.entryYear} Set
                    {g.canWrite ? " · You coordinate this level" : " · View only"}
                </p>
            </header>

            <GenerationDetail generation={g} />
        </div>
    );
}
