import { MapPin } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

/**
 * Zone module — parked as "coming soon" during the foundation pass. The zone
 * management implementation lives in ./components and ./actions and will be wired
 * back up in a later phase. See .plan / AGENTS.md.
 */
export default function ZonesPage() {
    return (
        <ComingSoon
            icon={MapPin}
            title="Zones"
            description="Residential zone management is coming soon."
        />
    );
}
