"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Crown, UserCog, Cake, History } from "lucide-react";
import { UnitManager } from "./unit-manager";
import { UnitPositionsManager } from "./unit-positions-manager";
import { UnitLeadershipCard } from "./unit-leadership-card";
import { UnitTabs, type UnitTab } from "./unit-tabs";
import { BirthdaysPanel } from "./birthdays-panel";
import { MembershipLog } from "./membership-log";

type UnitTabId = "members" | "birthdays" | "log" | "positions" | "leadership";

const LEADER_TABS: UnitTab<UnitTabId>[] = [
    { id: "members", label: "Members", icon: Users },
    { id: "birthdays", label: "Birthdays", icon: Cake },
    { id: "log", label: "Log", icon: History },
];

const ADMIN_TABS: UnitTab<UnitTabId>[] = [
    ...LEADER_TABS,
    { id: "positions", label: "Positions", icon: UserCog },
    { id: "leadership", label: "Leadership", icon: Crown },
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
    tenureId,
    view,
    readOnly,
    initialTab,
}: {
    unit: { id: string; slug: string; name: string; type: "UNIT" | "TEAM" };
    tenureId: string | null;
    view: "ADMIN" | "LEADER";
    readOnly: boolean;
    /** Straight from the URL, so anything; an unknown or out-of-view tab opens Members. */
    initialTab?: string;
}) {
    const router = useRouter();
    const tabs = view === "ADMIN" ? ADMIN_TABS : LEADER_TABS;
    const [tab, setTab] = useState<UnitTabId>(
        () => tabs.find((t) => t.id === initialTab)?.id ?? "members",
    );

    const change = (next: UnitTabId) => {
        setTab(next);
        const url = new URL(window.location.href);
        if (next === "members") url.searchParams.delete("tab");
        else url.searchParams.set("tab", next);
        window.history.replaceState(null, "", url);
    };

    return (
        <div>
            <UnitTabs tabs={tabs} active={tab} onChange={change} />

            {tab === "members" && (
                <UnitManager unit={unit} readOnly={readOnly} onChanged={() => router.refresh()} />
            )}
            {tab === "birthdays" && <BirthdaysPanel unitId={unit.id} />}
            {tab === "log" && <MembershipLog unitId={unit.id} />}
            {tab === "positions" && (
                <UnitPositionsManager unit={unit} tenureId={tenureId ?? ""} onSuccess={() => router.refresh()} />
            )}
            {tab === "leadership" && (
                <UnitLeadershipCard
                    unitId={unit.id}
                    unitName={unit.name}
                    unitType={unit.type}
                    tenureId={tenureId ?? ""}
                />
            )}
        </div>
    );
}
