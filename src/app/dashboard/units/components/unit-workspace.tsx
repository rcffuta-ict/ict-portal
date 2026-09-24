"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Crown, Cake, GraduationCap } from "lucide-react";
import { UnitManager } from "./unit-manager";
import { UnitExecutives } from "./unit-executives";
import { WorkspaceTabs, type WorkspaceTab } from "@/components/dashboard/roster/workspace-tabs";
import { BirthdaysPanel } from "./birthdays-panel";
import { ComingSoon } from "@/components/dashboard/coming-soon";

type UnitTabId = "members" | "leadership" | "birthdays" | "academics";

// Every viewer gets the same tabs: each one is read from the roster the viewer can
// already open. (The membership log is still recorded, just not a tab here.)
const TABS: WorkspaceTab<UnitTabId>[] = [
    { id: "members", label: "Members", icon: Users },
    { id: "leadership", label: "Leadership", icon: Crown },
    { id: "birthdays", label: "Birthdays", icon: Cake },
    { id: "academics", label: "Academics", icon: GraduationCap, badge: "Soon" },
];

/**
 * The tabs of one unit's page.
 *
 * The open tab is mirrored into `?tab=` with replaceState rather than a navigation: a
 * refresh or a shared link lands on the same tab, but switching tabs costs no server
 * round-trip, which matters on mobile data.
 */
export function UnitWorkspace({
    unit,
    readOnly,
    initialTab,
}: {
    unit: { id: string; slug: string; name: string; type: "UNIT" | "TEAM" };
    readOnly: boolean;
    /** Straight from the URL, so anything; an unknown tab (an old ?tab=log) opens Members. */
    initialTab?: string;
}) {
    const router = useRouter();
    const [tab, setTab] = useState<UnitTabId>(
        () => TABS.find((t) => t.id === initialTab)?.id ?? "members",
    );

    const change = (next: UnitTabId) => {
        setTab(next);
        const url = new URL(window.location.href);
        if (next === "members") url.searchParams.delete("tab");
        else url.searchParams.set("tab", next);
        window.history.replaceState(null, "", url);
    };

    return (
        <div className="space-y-5">
            <WorkspaceTabs tabs={TABS} active={tab} onChange={change} label="Unit sections" />

            {tab === "members" && (
                <UnitManager unit={unit} readOnly={readOnly} onChanged={() => router.refresh()} />
            )}
            {tab === "leadership" && <UnitExecutives unit={unit} />}
            {tab === "birthdays" && <BirthdaysPanel unitId={unit.id} unitName={unit.name} />}
            {tab === "academics" && (
                <ComingSoon
                    title="Academics"
                    icon={GraduationCap}
                    description={`Academic records for ${unit.name}'s members are coming soon. The ICT team is working on it.`}
                />
            )}
        </div>
    );
}
