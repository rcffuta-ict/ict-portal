import type { Metadata } from "next";
import { WorkforceDashboard } from "./components/workforce-dashboard";

export const metadata: Metadata = {
    title: "Workforce",
    description: "Manage the members of your unit or team.",
};

/**
 * Workforce (units/teams). Access is decided server-side in getUnitModuleData
 * (`workforce` module read) and again in every action — see ./actions.ts.
 */
export default function UnitsPage() {
    return <WorkforceDashboard />;
}
