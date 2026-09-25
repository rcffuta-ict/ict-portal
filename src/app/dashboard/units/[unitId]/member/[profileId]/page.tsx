import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { getUnitMemberDetailAction } from "../../../actions";
import { MemberDetailView } from "@/components/dashboard/member-detail-view";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { UpdateLink } from "../../../components/update-link";

export const metadata: Metadata = {
    title: "Member — Workforce",
    description: "Full member detail for a unit's Executive.",
};

/**
 * One member, seen from their unit: the same full detail a level coordinator sees.
 *
 * Server-rendered, so it arrives complete on a slow connection. Access is decided in
 * getUnitMemberDetailAction — the caller must manage (or, as admin, read) this unit AND
 * the member must actually be in it this session.
 */
export default async function UnitMemberPage({
    params,
}: {
    params: Promise<{ unitId: string; profileId: string }>;
}) {
    const { unitId, profileId } = await params;
    const res = await getUnitMemberDetailAction(unitId, profileId);

    if (!res.success) {
        return (
            <div className="space-y-4">
                <Breadcrumb items={[{ label: "Workforce", href: "/dashboard/units" }, { label: "Member" }]} />
                <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                    <ShieldAlert className="h-10 w-10 text-amber-500" aria-hidden="true" />
                    <h1 className="text-lg font-bold text-rcf-navy">Not available</h1>
                    <p className="text-sm text-gray-600">{res.error}</p>
                </div>
            </div>
        );
    }

    const firstName = res.data.profile?.firstName || "this member";

    return (
        <div className="space-y-6 pb-16">
            <Breadcrumb
                items={[
                    { label: "Workforce", href: "/dashboard/units" },
                    { label: res.unitName, href: `/dashboard/units/${unitId}` },
                    { label: res.data.profile?.firstName || "Member" },
                ]}
            />

            <MemberDetailView detail={res.data} />

            {res.canManage && <UpdateLink unitId={unitId} profileId={profileId} memberName={firstName} />}
        </div>
    );
}
