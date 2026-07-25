import { ShieldAlert } from "lucide-react";
import {
    getGenerationAction,
    getLevelMembersAction,
    getLevelStatsAction,
    listLevelInvitesAction,
} from "../actions";
import { GenerationDetail } from "../components/generation-detail";
import { Breadcrumb } from "../components/breadcrumb";

/**
 * A single generation's page: members, tokens and token activity.
 *
 * Everything the first paint needs is fetched HERE, on the server, in parallel — the
 * client components mount already populated instead of firing their own round-trips, so
 * the page is usable the moment it lands rather than after a spinner on mobile data.
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

    // Tokens are only fetched for coordinators — a token is a credential, so it must not
    // ride along in the payload of a read-only viewer.
    const [members, stats, tokens] = await Promise.all([
        getLevelMembersAction(classSetId, { page: 1, pageSize: 24 }),
        getLevelStatsAction(classSetId),
        g.canWrite ? listLevelInvitesAction(classSetId) : Promise.resolve({ data: [] }),
    ]);

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

            <GenerationDetail
                generation={g}
                initialMembers={members.data || []}
                initialTotal={members.total || 0}
                initialStats={"stats" in stats ? stats.stats : null}
                initialTokens={tokens.data || []}
            />
        </div>
    );
}
