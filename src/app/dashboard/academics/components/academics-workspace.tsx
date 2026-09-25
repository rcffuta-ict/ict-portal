"use client";

import { useState } from "react";
import { BarChart3, Building2, ClipboardList, Megaphone, SlidersHorizontal } from "lucide-react";
import { WorkspaceTabs, type WorkspaceTab } from "@/components/dashboard/roster/workspace-tabs";
import type { AcademicRound, AcademicSettings } from "@/lib/academics-db";
import { OverviewPanel } from "./overview-panel";
import { RoundsPanel } from "./rounds-panel";
import { RecordsPanel } from "./records-panel";
import { DepartmentsPanel } from "./departments-panel";
import { SettingsPanel } from "./settings-panel";

type TabId = "overview" | "rounds" | "records" | "departments" | "settings";

const TABS: WorkspaceTab<TabId>[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "rounds", label: "Rounds", icon: Megaphone },
    { id: "records", label: "Records", icon: ClipboardList },
    { id: "departments", label: "Departments", icon: Building2 },
    { id: "settings", label: "Visibility", icon: SlidersHorizontal },
];

/**
 * The Academics module's tabs. Like the unit workspace, the open tab is mirrored into
 * `?tab=` with replaceState: a refresh lands on the same tab, and switching costs no
 * server round-trip. Each tab loads its own data when opened, so the first paint only
 * pays for the tab in view.
 */
export function AcademicsWorkspace({
    canWrite,
    rounds,
    settings,
    activeSession,
    initialTab,
}: {
    canWrite: boolean;
    rounds: AcademicRound[];
    settings: AcademicSettings;
    activeSession: string | null;
    initialTab?: string;
}) {
    const [tab, setTab] = useState<TabId>(() => TABS.find((t) => t.id === initialTab)?.id ?? "overview");

    const change = (next: TabId) => {
        setTab(next);
        const url = new URL(window.location.href);
        if (next === "overview") url.searchParams.delete("tab");
        else url.searchParams.set("tab", next);
        window.history.replaceState(null, "", url);
    };

    return (
        <div className="space-y-5">
            <WorkspaceTabs tabs={TABS} active={tab} onChange={change} label="Academics sections" />
            {tab === "overview" && <OverviewPanel rounds={rounds} />}
            {tab === "rounds" && <RoundsPanel rounds={rounds} canWrite={canWrite} activeSession={activeSession} />}
            {tab === "records" && <RecordsPanel canWrite={canWrite} activeSession={activeSession} />}
            {tab === "departments" && <DepartmentsPanel canWrite={canWrite} />}
            {tab === "settings" && <SettingsPanel settings={settings} canWrite={canWrite} />}
        </div>
    );
}
