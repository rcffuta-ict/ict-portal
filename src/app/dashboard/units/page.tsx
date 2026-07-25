import { SquaresUnite } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

/**
 * Workforce (units/teams) module — parked as "coming soon" during the foundation
 * pass. The implementation lives in ./components and ./actions and will be wired
 * back up in a later phase. See .plan / AGENTS.md.
 */
export default function UnitsPage() {
    return (
        <ComingSoon
            icon={SquaresUnite}
            title="Workforce"
            description="Unit and team management is coming soon."
        />
    );
}
