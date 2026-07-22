import { ShieldAlert } from "lucide-react";
import { getMemberDetailAction } from "../../../actions";
import { MemberDetailView } from "../../../components/member-detail-view";
import { Breadcrumb } from "../../../components/breadcrumb";
import { MemberUpdateLink } from "../../../components/member-update-link";

/**
 * Full detail for one member — its own page, breadcrumbed back to its generation.
 */
export default async function MemberPage({
    params,
}: {
    params: Promise<{ classSetId: string; profileId: string }>;
}) {
    const { classSetId, profileId } = await params;
    const res = await getMemberDetailAction(profileId);

    if (!res.success || !res.data) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                <ShieldAlert className="h-10 w-10 text-amber-500" />
                <h1 className="text-lg font-bold text-rcf-navy">Not available</h1>
                <p className="text-sm text-gray-600">{res.error || "You don't have access to this member."}</p>
            </div>
        );
    }

    const detail = res.data;
    const p = detail.profile || {};
    const generationName = detail.classSet?.familyName || "Generation";
    const memberName = [p.firstName, p.lastName].filter(Boolean).join(" ") || "Member";

    return (
        <div className="space-y-6">
            <Breadcrumb
                items={[
                    { label: "Levels", href: "/dashboard/level" },
                    { label: generationName, href: `/dashboard/level/${classSetId}` },
                    { label: memberName },
                ]}
            />

            <MemberDetailView detail={detail} />

            {res.canWrite && (
                <MemberUpdateLink
                    classSetId={classSetId}
                    profileId={profileId}
                    memberName={p.firstName || "this member"}
                />
            )}
        </div>
    );
}
