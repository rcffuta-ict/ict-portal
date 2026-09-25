"use client";

import { UnitCard, UNIT_CARD_GRID, type UnitCardData } from "@/components/dashboard/unit-card";

export interface LeaderUnit extends UnitCardData {
    id: string;
    slug: string;
    leadershipRole: string;
}

/**
 * The units and teams an Executive (lead or assistant) manages; each opens its own page.
 * Same compact card as the admin list, with the viewer's own office under the name.
 */
export function LeaderUnitView({ units }: { units: LeaderUnit[] }) {
    return (
        <ul className={UNIT_CARD_GRID}>
            {units.map((u) => (
                <li key={u.id}>
                    <UnitCard unit={u} href={`/dashboard/units/${u.id}`} note={u.leadershipRole} />
                </li>
            ))}
        </ul>
    );
}
