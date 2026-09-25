import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { getUnitPageAction } from "../actions";
import { UnitWorkspace } from "../components/unit-workspace";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";

/** Names the unit, so open tabs for several units stay distinguishable. */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ unitId: string }>;
}): Promise<Metadata> {
    const { unitId } = await params;
    const res = await getUnitPageAction(unitId);
    return {
        title: res.success ? `${res.unit.name} — Workforce` : "Unit — Workforce",
        description: "Members, birthdays and history for one unit or team.",
    };
}

/**
 * One unit or team, as its own page rather than a dialog over the Workforce grid.
 *
 * A page can be linked, refreshed and left with the phone's back button, and a member's
 * page can point back here instead of dropping you at the grid with the unit closed.
 * Access is decided in getUnitPageAction, and again by every action the tabs call.
 */
export default async function UnitPage({
    params,
    searchParams,
}: {
    params: Promise<{ unitId: string }>;
    searchParams: Promise<{ tab?: string }>;
}) {
    const [{ unitId }, { tab }] = await Promise.all([params, searchParams]);
    const res = await getUnitPageAction(unitId);

    if (!res.success) {
        return (
            <div className="space-y-6">
                <Breadcrumb items={[{ label: "Workforce", href: "/dashboard/units" }, { label: "Unit" }]} />
                <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                    <ShieldAlert className="h-10 w-10 text-amber-500" aria-hidden="true" />
                    <h1 className="text-lg font-bold text-rcf-navy">Not available</h1>
                    <p className="text-sm text-gray-600">{res.error}</p>
                </div>
            </div>
        );
    }

    const { unit } = res;

    return (
        <div className="space-y-6 pb-20">
            <Breadcrumb items={[{ label: "Workforce", href: "/dashboard/units" }, { label: unit.name }]} />

            <header className="border-b border-slate-200 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-rcf-navy">{unit.name}</h1>
                <p className="mt-1 text-sm text-slate-500">
                    {unit.type === "UNIT" ? "Unit" : "Team"}
                    {res.leadershipRole && ` · As ${res.leadershipRole}`}
                    {res.readOnly && " · View only"}
                </p>
            </header>

            {!res.tenureId && (
                <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    There is no active session, so there is no roster to manage yet.
                </p>
            )}

            <UnitWorkspace
                unit={unit}
                readOnly={res.readOnly}
                initialTab={tab}
            />
        </div>
    );
}
