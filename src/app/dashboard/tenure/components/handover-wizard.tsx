/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    X,
    ArrowRight,
    ArrowLeft,
    GraduationCap,
    ShieldOff,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    Users,
    Pin,
    Archive,
    CalendarDays,
    TrendingUp,
    UserCheck,
    Settings2,
    Flag,
} from "lucide-react";
import {
    getHandoverPreviewAction,
    handoverTenureAction,
    searchMemberAction,
    saveHandoverProgressAction,
} from "../actions";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";
import FormInput from "@/components/ui/FormInput";
import { BackupPicker } from "@/components/dashboard/backup-picker";
import { tenureFullLabel } from "@/lib/tenure";
import { MemberAvatar } from "@/components/dashboard/roster/member-avatar";
import { HandoverFinalists, type Finalist } from "./handover-finalists";

/**
 * The handover wizard.
 *
 * ONE STEP AT A TIME, deliberately. Every step has to be satisfied before the next
 * unlocks, and the commit lives alone on the last one — so the VP Admin cannot arrive
 * at an irreversible button by scrolling past things they haven't read.
 *
 * The order is not arbitrary:
 *   1. Back up          — the only undo that exists, so it comes before anything else.
 *   2. Incoming tenure  — the session string is the single value that re-levels everyone.
 *   3. Progression      — shown immediately after, so that consequence is unmissable.
 *   4. Offices          — the new tenure must never be left unadministrable.
 *   5. Everyone else    — membership and access, both opt-out.
 *   6. Commit           — a summary, then type the session to confirm. This
 *                         SCHEDULES the switch: it takes effect an hour later, and
 *                         can be cancelled until then (handover-scheduled.tsx).
 *
 * On step 3: a member's level is never stored. It is computed from their generation's
 * entry year against the ACTIVE TENURE'S SESSION, so advancing the session moves every
 * generation forward and retires the finalists on its own. Nothing is rewritten, which
 * is exactly why the preview can be trusted as literal.
 */

/** Only the fields the wizard displays and submits are persisted to the intent. */
interface PickedMember {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
    level?: string | null;
}

const STEPS = [
    { id: "backup", label: "Back up", icon: Archive },
    { id: "tenure", label: "New tenure", icon: CalendarDays },
    { id: "progression", label: "Progression", icon: TrendingUp },
    { id: "offices", label: "Offices", icon: UserCheck },
    { id: "aftermath", label: "Everyone else", icon: Settings2 },
    { id: "commit", label: "Hand over", icon: Flag },
] as const;

/**
 * What each step writes into the intent's proceedings log when it is completed.
 *
 * Phrased as the decision that was made, not "step 3 done" — the log is read a year
 * later by someone reconstructing what their predecessor chose.
 */
const STEP_NOTES: Record<
    number,
    (s: {
        form: { session: string; startDate: string };
        vpAdmin: PickedMember | null;
        ictCoord: PickedMember | null;
        carryMembership: boolean;
        revokeOutgoing: boolean;
    }) => string
> = {
    0: () => "Backup confirmed.",
    1: ({ form }) => `Incoming session set: ${form.session}, starting ${form.startDate}.`,
    2: ({ form }) => `Generation progression reviewed and accepted for ${form.session}.`,
    3: ({ vpAdmin, ictCoord }) =>
        `Appointed ${name(vpAdmin)} as VP Admin and ${name(ictCoord)} as ICT Coordinator.`,
    4: ({ carryMembership, revokeOutgoing }) =>
        `Membership ${carryMembership ? "carried forward" : "not carried forward"}; outgoing logins ${revokeOutgoing ? "revoked" : "left in place"}.`,
};

function name(m: PickedMember | null): string {
    return [m?.first_name, m?.last_name].filter(Boolean).join(" ") || "someone";
}

export function HandoverWizard({
    intentId,
    initialStep,
    initialPayload,
    currentTenure,
}: {
    /** The handover_intents row this wizard is filling in. */
    intentId: string;
    initialStep: number;
    initialPayload: Record<string, unknown>;
    /** `label` is the closing tenure's full label (theme · session, or awaiting coronation). */
    currentTenure: { id: string; label: string; session: string };
}) {
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    // Resume exactly where this intent was left. A handover spans interruptions —
    // a meeting, a flat battery, a question someone had to go and ask — and starting
    // over each time is how a six-step procedure gets rushed.
    // Drafts begun before tenures lost their names may still carry `name`/`theme`;
    // they are simply not read. The theme is recorded at coronation, not here.
    const saved = (initialPayload ?? {}) as Partial<{
        session: string;
        startDate: string;
        vpAdmin: PickedMember;
        ictCoord: PickedMember;
        carryMembership: boolean;
        revokeOutgoing: boolean;
        acknowledged: boolean;
        finalists: Finalist[];
    }>;

    const [step, setStep] = useState(Math.min(initialStep ?? 0, STEPS.length - 1));
    const [form, setForm] = useState({
        session: saved.session ?? suggestNextSession(currentTenure.session),
        startDate: saved.startDate ?? new Date().toISOString().slice(0, 10),
    });

    const [preview, setPreview] = useState<any>(null);
    const [previewLoading, setPreviewLoading] = useState(true);
    const [previewKey, setPreviewKey] = useState(0);

    const [vpAdmin, setVpAdmin] = useState<PickedMember | null>(saved.vpAdmin ?? null);
    const [ictCoord, setIctCoord] = useState<PickedMember | null>(saved.ictCoord ?? null);
    const [carryMembership, setCarryMembership] = useState(saved.carryMembership ?? true);
    const [revokeOutgoing, setRevokeOutgoing] = useState(saved.revokeOutgoing ?? true);
    const [acknowledged, setAcknowledged] = useState(saved.acknowledged ?? false);
    const [finalists, setFinalists] = useState<Finalist[]>(saved.finalists ?? []);
    const [saving, setSaving] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();

    const session = form.session.trim();

    useEffect(() => {
        if (!session) return;
        let cancelled = false;

        (async () => {
            const res = await getHandoverPreviewAction(session);
            if (cancelled) return;
            setPreview(res.success ? res : null);
            setPreviewLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [session, previewKey]);

    const refreshPreview = () => {
        setPreviewLoading(true);
        setPreviewKey((k) => k + 1);
    };

    const hasBackup = !!preview?.backup;
    const auditUnavailable = preview?.backupTrackingUnavailable === true;
    const generations = preview?.generations ?? [];
    const graduating = generations.filter((g: any) => g.becomesAlumni);
    // 400 Level finalists join the 500 Level generation that is becoming alumni. Both
    // must exist (and 400 Level must not be pinned) for the choice to be offered.
    const fourHundred = generations.find((g: any) => g.from === "400 Level" && !g.pinned && !g.isFoundation);
    const alumniGen = generations.find((g: any) => g.from === "500 Level" && g.becomesAlumni);
    const offerFinalists = !!fourHundred && !!alumniGen;
    const finalistsToSend = offerFinalists ? finalists : [];
    const losing = preview?.losingAccess ?? [];

    /** Each step's gate. A step can only be left once its own condition is met. */
    const stepComplete = useMemo(
        () => [
            hasBackup,
            !!session && !!form.startDate,
            acknowledged && !!preview,
            !!vpAdmin && !!ictCoord,
            true, // both options have defaults; there is nothing to get wrong
            confirmText.trim() === session && !!session,
        ],
        [hasBackup, session, form.startDate, acknowledged, preview, vpAdmin, ictCoord, confirmText],
    );

    /** Everything worth resuming from. */
    const payload = () => ({
        session: form.session,
        startDate: form.startDate,
        vpAdmin,
        ictCoord,
        carryMembership,
        revokeOutgoing,
        acknowledged,
        finalists,
    });

    /**
     * Persist progress, then move.
     *
     * The save is awaited rather than fired and forgotten: the whole point is that
     * closing the tab loses nothing, and a save still in flight when the page goes away
     * would quietly break that promise.
     */
    const goTo = async (next: number, note?: string) => {
        setSaving(true);
        await saveHandoverProgressAction(intentId, {
            step: next,
            payload: payload(),
            note,
        });
        setSaving(false);
        setStep(next);
    };

    const submit = async () => {
        // Step 4's gate already requires both, but the types don't know that and the
        // server would reject a blank id with a worse message than this.
        if (!vpAdmin || !ictCoord) {
            showAlert({
                type: "error",
                title: "Missing appointments",
                message: "Go back and choose the incoming VP Admin and ICT Coordinator.",
            });
            return;
        }

        setSubmitting(true);
        const fd = new FormData();
        fd.append("intentId", intentId);
        fd.append("session", session);
        fd.append("startDate", form.startDate);
        fd.append("vpAdminProfileId", vpAdmin.id);
        fd.append("ictCoordProfileId", ictCoord.id);
        fd.append("carryMembership", carryMembership ? "true" : "false");
        fd.append("revokeOutgoing", revokeOutgoing ? "true" : "false");
        fd.append("finalistIds", JSON.stringify(finalistsToSend.map((f) => f.id)));

        let res: Awaited<ReturnType<typeof handoverTenureAction>>;
        try {
            res = await handoverTenureAction(fd);
        } catch {
            res = { success: false as const, error: "Couldn't reach the server. Nothing was changed; try again." };
        }

        if (!res.success) {
            setSubmitting(false);
            showAlert({
                type: "error",
                title: "Handover not scheduled",
                message: res.error || "Unknown error. Nothing was changed.",
            });
            return;
        }
        // The page re-renders as the scheduled screen, with its countdown and Cancel.
        // `submitting` stays on so the button can't be pressed again meanwhile.
        router.refresh();
    };

    return (
        <>
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {/* Header: identity of the act, an exit, and the progress rail. */}
            <header className="safe-top shrink-0 border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-4 pb-3 pt-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">
                            Tenure Handover
                        </p>
                        <h1 className="truncate text-lg font-bold text-rcf-navy">
                            Closing {currentTenure.label}
                        </h1>
                        <p className="truncate text-xs text-slate-500">
                            Session {currentTenure.session} · step {step + 1} of {STEPS.length}
                        </p>
                    </div>

                    <a
                        href="/dashboard/tenure"
                        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                    >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        Leave
                    </a>
                </div>

                <div className="mx-auto max-w-3xl px-4 pb-3">
                    <StepRail step={step} complete={stepComplete} onJump={(n) => goTo(n)} />
                </div>
            </header>

            {/* Body: exactly one procedure, filling everything that's left. */}
            <main className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
                    {step === 0 && (
                        <StepBody
                            title="Back up everything first"
                            blurb="A handover cannot be undone from inside the portal. This file is the undo — take it now, not later."
                        >
                            {auditUnavailable ? (
                                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                Backup downloads aren&rsquo;t being recorded, so the handover can&rsquo;t
                                verify one was taken. Apply{" "}
                                    <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-[11px]">
                                    db/migrations/0010_admin_audit_log.sql
                                    </code>{" "}
                                and reload this page.
                                </p>
                            ) : hasBackup ? (
                                <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                    <span>
                                    Backed up {formatWat(preview.backup.takenAt)}
                                        {preview.backup.takenBy ? ` by ${preview.backup.takenBy}` : ""}.
                                    You can download another if you want a fresher copy.
                                    </span>
                                </p>
                            ) : (
                                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                No backup has been taken during{" "}
                                    <strong>{currentTenure.label}</strong> yet. Download one to continue —
                                an older bundle wouldn&rsquo;t contain this tenure&rsquo;s appointments
                                or transfers.
                                </p>
                            )}

                            <div className="mt-5">
                                <BackupPicker
                                    tenureId={currentTenure.id}
                                    tenureLabel={currentTenure.label}
                                    presidentName={preview?.presidentName ?? null}
                                    // The download is fetched, so this fires once it lands —
                                    // give the audit row a moment, then re-check the gate.
                                    onDownloaded={() => setTimeout(refreshPreview, 1200)}
                                />
                            </div>

                            <p className="mt-4 text-xs leading-relaxed text-slate-500">
                                Included by default: <strong>every previous handover record</strong>,
                                not just this one — so the chain of who handed over to whom, and what
                                they decided, survives a restore. Passwords and live sessions are
                                deliberately left out; leaders set a new password on first login
                                afterwards.
                            </p>

                        </StepBody>
                    )}

                    {step === 1 && (
                        <StepBody
                            title="The incoming session"
                            blurb="The session is the value that re-levels the whole fellowship. The theme comes later — it is unveiled at coronation and recorded then."
                        >
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormInput
                                    label="Session"
                                    value={form.session}
                                    placeholder="2027/2028"
                                    onChange={(e) => {
                                        setPreviewLoading(true);
                                        setAcknowledged(false); // a new session means a new progression
                                        setForm({ ...form, session: e.target.value });
                                    }}
                                />
                                <FormInput
                                    label="Start date"
                                    type="date"
                                    value={form.startDate}
                                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                />
                            </div>

                            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                            Currently <strong>{currentTenure.session}</strong>. Moving to{" "}
                                <strong>{session || "…"}</strong> advances every generation by one level.
                            You&rsquo;ll see exactly what that means next.
                            </p>
                        </StepBody>
                    )}

                    {step === 2 && (
                        <StepBody
                            title="How the generations move"
                            blurb="Nothing is rewritten — level is computed from the session, so this is literally what will happen."
                        >
                            {previewLoading ? (
                                <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                Working out the progression…
                                </p>
                            ) : !preview ? (
                                <p className="py-6 text-sm text-slate-500">
                                Couldn&rsquo;t load the progression. Go back and check the session.
                                </p>
                            ) : (
                                <>
                                    <ul className="space-y-1.5">
                                        {generations.map((g: any) => (
                                            <li
                                                key={g.classSetId}
                                                className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2.5 text-xs ${
                                                    g.becomesAlumni ? "bg-amber-50" : "bg-slate-50"
                                                }`}
                                            >
                                                <span className="font-bold text-slate-800">
                                                    {g.familyName || `${g.entryYear} set`}
                                                </span>
                                                <span className="text-slate-400">({g.entryYear})</span>
                                                <span className="ml-auto flex items-center gap-1.5">
                                                    <span className="text-slate-500">{g.from ?? "—"}</span>
                                                    <ArrowRight className="h-3 w-3 text-slate-300" aria-hidden="true" />
                                                    <span className={`font-bold ${g.becomesAlumni ? "text-amber-700" : "text-rcf-navy"}`}>
                                                        {g.to ?? "—"}
                                                    </span>
                                                    {g.pinned && (
                                                        <Pin className="h-3 w-3 text-slate-400" aria-label="Pinned — will not advance" />
                                                    )}
                                                    {g.isFoundation && (
                                                        <span className="text-[10px] font-semibold uppercase text-amber-700">emptied</span>
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>

                                    <p className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                                        <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                        <span>
                                            <strong>PDS/UABS and 100 Level start empty.</strong>{" "}
                                            {preview.foundationMembers
                                                ? `Last session's ${preview.foundationMembers} PDS/UABS member${preview.foundationMembers === 1 ? " is" : "s are"} unlinked from their generation and re-join through a level link once admitted. `
                                                : ""}
                                            {preview.firstYear ? `A ${preview.firstYear} generation is created for 100 Level if there isn't one.` : ""}
                                        </span>
                                    </p>

                                    {graduating.length > 0 && (
                                        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                                            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                            <span>
                                                <strong>{graduating.map((g: any) => g.familyName || g.entryYear).join(", ")}</strong>{" "}
                                            become alumni. They keep their profiles, but leave level
                                            rosters and the workforce.
                                            </span>
                                        </p>
                                    )}

                                    {offerFinalists && (
                                        <HandoverFinalists
                                            classSetId={fourHundred.classSetId}
                                            fourHundredName={fourHundred.familyName || `${fourHundred.entryYear} set`}
                                            alumniName={alumniGen.familyName || `${alumniGen.entryYear} set`}
                                            selected={finalists}
                                            onChange={setFinalists}
                                        />
                                    )}

                                    <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={acknowledged}
                                            onChange={(e) => setAcknowledged(e.target.checked)}
                                            className="mt-0.5 h-4 w-4 shrink-0 accent-rcf-navy"
                                        />
                                        <span className="text-sm text-slate-700">
                                        I&rsquo;ve read the progression above and it&rsquo;s correct.
                                        </span>
                                    </label>
                                </>
                            )}
                        </StepBody>
                    )}

                    {step === 3 && (
                        <StepBody
                            title="Who takes the protected offices"
                            blurb="Appointed the moment the new tenure opens, so it is never left unadministrable."
                        >
                            <div className="grid gap-5 sm:grid-cols-2">
                                <MemberPicker label="Incoming VP Admin" selected={vpAdmin} onSelect={setVpAdmin} />
                                <MemberPicker label="Incoming ICT Coordinator" selected={ictCoord} onSelect={setIctCoord} />
                            </div>
                            <p className="mt-4 text-xs leading-relaxed text-slate-500">
                            Both get a portal login automatically, with no password — they set one on
                            their first sign-in. Every other position starts vacant and is filled from
                            the Cabinet tab.
                            </p>
                        </StepBody>
                    )}

                    {step === 4 && (
                        <StepBody
                            title="What happens to everyone else"
                            blurb="Both default to the safer choice. You can still change either one."
                        >
                            <div className="space-y-3">
                                <Toggle
                                    checked={carryMembership}
                                    onChange={setCarryMembership}
                                    icon={Users}
                                    title="Carry unit and team membership forward"
                                    detail={
                                        preview
                                            ? `${preview.membershipCount} membership${preview.membershipCount === 1 ? "" : "s"} would move across, minus anyone graduating. Turn this off and every unit starts the session empty.`
                                            : "Membership is tenure-scoped — without this, every unit starts empty."
                                    }
                                />
                                <Toggle
                                    checked={revokeOutgoing}
                                    onChange={setRevokeOutgoing}
                                    icon={ShieldOff}
                                    title="Revoke portal access for outgoing leaders"
                                    detail={
                                        losing.length
                                            ? `${losing.length} leader${losing.length === 1 ? "" : "s"} lose their login unless reappointed: ${losing.slice(0, 4).map((l: any) => l.name).join(", ")}${losing.length > 4 ? `, +${losing.length - 4} more` : ""}.`
                                            : "Nobody currently holds a position in the outgoing tenure."
                                    }
                                />
                            </div>
                        </StepBody>
                    )}

                    {step === 5 && (
                        <StepBody
                            title="Ready to hand over"
                            blurb="Last look. Nothing has changed yet, and nothing will for an hour after you confirm."
                        >
                            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                                <Row label="Closing">{currentTenure.label}</Row>
                                <Row label="Opening">{tenureFullLabel({ session })}</Row>
                                <Row label="VP Admin">{vpAdmin?.first_name} {vpAdmin?.last_name}</Row>
                                <Row label="ICT Coordinator">{ictCoord?.first_name} {ictCoord?.last_name}</Row>
                                <Row label="Becoming alumni">
                                    {graduating.length
                                        ? graduating.map((g: any) => g.familyName || g.entryYear).join(", ")
                                        : "Nobody"}
                                </Row>
                                {finalistsToSend.length > 0 && (
                                    <Row label="400 Level finalists">
                                        {finalistsToSend.length} join {alumniGen.familyName || `${alumniGen.entryYear} set`} as alumni
                                    </Row>
                                )}
                                <Row label="Membership">
                                    {carryMembership ? `${preview?.membershipCount ?? 0} carried forward` : "Not carried — units start empty"}
                                </Row>
                                <Row label="PDS/UABS">
                                    {preview?.foundationMembers ? `${preview.foundationMembers} unlinked` : "Empty"}
                                </Row>
                                <Row label="Results round">
                                    {preview?.openRound ? `${preview.openRound} closed` : "None open"}
                                </Row>
                                <Row label="Outgoing access">
                                    {revokeOutgoing ? `${losing.length} login${losing.length === 1 ? "" : "s"} revoked` : "Left in place"}
                                </Row>
                            </dl>

                            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/60 p-4">
                                <h4 className="flex items-center gap-2 text-sm font-bold text-red-800">
                                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                                This cannot be undone once it takes effect
                                </h4>
                                <p className="mt-1 text-xs leading-relaxed text-red-700">
                                It takes effect <strong>one hour</strong> after you confirm. Until then
                                the outgoing cabinet keeps working, and you can still cancel. Type the
                                incoming session to confirm you mean it.
                                </p>
                                <div className="mt-3">
                                    <FormInput
                                        label={`Type "${session}" to confirm`}
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        placeholder={session}
                                    />
                                </div>
                                <button
                                    type="button"
                                    disabled={!stepComplete[5] || submitting}
                                    onClick={submit}
                                    className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-6 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {submitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <Flag className="h-4 w-4" aria-hidden="true" />
                                    )}
                                    {submitting ? "Scheduling…" : `Hand over to ${session || "the new session"} in 1 hour`}
                                </button>
                            </div>
                        </StepBody>
                    )}

                </div>
            </main>

            {/*
              Footer navigation, pinned so it never scrolls out of reach on a phone.
              The COMMIT is deliberately not here — it lives inside the final step, next
              to the confirmation field, so the last thing you touch is never the same
              button you have been tapping to move forward.
            */}
            <footer className="safe-bottom shrink-0 border-t border-slate-200 bg-white">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
                    <button
                        type="button"
                        onClick={() => goTo(Math.max(0, step - 1))}
                        disabled={step === 0 || saving}
                        className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-40"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Back
                    </button>

                    {step < STEPS.length - 1 ? (
                        <button
                            type="button"
                            onClick={() =>
                                goTo(Math.min(STEPS.length - 1, step + 1), STEP_NOTES[step]?.(
                                    { form, vpAdmin, ictCoord, carryMembership, revokeOutgoing },
                                ))
                            }
                            disabled={!stepComplete[step] || saving}
                            className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-rcf-navy px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                        >
                            {saving ? "Saving…" : "Continue"}
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            )}
                        </button>
                    ) : (
                        <p className="text-right text-xs text-slate-400">
                            Confirm above to finish
                        </p>
                    )}
                </div>
            </footer>
        </>
    );
}

// ---------------------------------------------------------------------------

/**
 * Progress rail. Scrolls horizontally on a phone rather than cramming six labels
 * into 360px, and only lets you jump BACK to a completed step — never forward past
 * one you haven't satisfied.
 */
function StepRail({
    step,
    complete,
    onJump,
}: {
    step: number;
    complete: boolean[];
    onJump: (n: number) => void;
}) {
    return (
        <nav aria-label="Handover progress" className="-mx-1 overflow-x-auto pb-1">
            <ol className="flex min-w-max items-center gap-1 px-1">
                {STEPS.map((s, i) => {
                    const Icon = s.icon;
                    const active = i === step;
                    const reachable = i < step || (i === step);
                    const isDone = complete[i] && i < step;

                    return (
                        <li key={s.id} className="flex items-center">
                            <button
                                type="button"
                                onClick={() => reachable && onJump(i)}
                                disabled={!reachable}
                                aria-current={active ? "step" : undefined}
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
                                    active
                                        ? "bg-rcf-navy text-white"
                                        : isDone
                                            ? "text-emerald-700 hover:bg-emerald-50"
                                            : "text-slate-400"
                                }`}
                            >
                                {isDone ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                ) : (
                                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                {s.label}
                            </button>
                            {i < STEPS.length - 1 && (
                                <span className="mx-0.5 h-px w-3 bg-slate-200" aria-hidden="true" />
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

function StepBody({
    title,
    blurb,
    children,
}: {
    title: string;
    blurb: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <h2 className="text-lg font-bold text-rcf-navy">{title}</h2>
            <p className="mb-5 mt-1 text-sm leading-relaxed text-slate-500">{blurb}</p>
            {children}
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-xs font-medium text-slate-400">{label}</dt>
            <dd className="min-w-0 text-right text-sm font-medium text-slate-800">{children}</dd>
        </div>
    );
}

function Toggle({
    checked,
    onChange,
    icon: Icon,
    title,
    detail,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    icon: any;
    title: string;
    detail: string;
}) {
    return (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-slate-300">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-rcf-navy"
            />
            <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{detail}</span>
            </span>
        </label>
    );
}

/** Type-ahead over the member roster, reusing the tenure module's search RPC. */
function MemberPicker({
    label,
    selected,
    onSelect,
}: {
    label: string;
    selected: any;
    onSelect: (m: any) => void;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const term = query.trim();
    // Derived rather than cleared inside the effect: wiping state synchronously while
    // an effect runs forces an extra render before paint.
    const tooShort = term.length < 2;

    useEffect(() => {
        if (tooShort) return;
        let cancelled = false;

        // Debounced — one request per pause, not per keystroke.
        const t = setTimeout(async () => {
            const rows = await searchMemberAction(term);
            if (cancelled) return;
            setResults(rows ?? []);
            setSearching(false);
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [term, tooShort]);

    if (selected) {
        return (
            <div className="space-y-1">
                <span className="ml-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    {label}
                </span>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                    <MemberAvatar url={selected.avatar_url} first={selected.first_name} last={selected.last_name} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-emerald-900">
                        {selected.first_name} {selected.last_name}
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            onSelect(null);
                            setQuery("");
                        }}
                        className="shrink-0 text-xs font-bold text-emerald-700 underline underline-offset-2"
                    >
                        Change
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <FormInput
                label={label}
                value={query}
                placeholder="Search by name or email…"
                onChange={(e) => {
                    setSearching(e.target.value.trim().length >= 2);
                    setQuery(e.target.value);
                }}
            />
            {searching && (
                <p className="ml-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    Searching…
                </p>
            )}
            {!tooShort && results.length > 0 && (
                <ul className="max-h-44 overflow-y-auto rounded-xl border border-slate-200">
                    {results.slice(0, 8).map((m) => (
                        <li key={m.id}>
                            <button
                                type="button"
                                onClick={() => onSelect(m)}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
                            >
                                <MemberAvatar url={m.avatar_url} first={m.first_name} last={m.last_name} size={32} />
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm font-medium text-slate-800">
                                        {m.first_name} {m.last_name}
                                    </span>
                                    <span className="truncate text-[11px] text-slate-400">
                                        {[m.email, m.level].filter(Boolean).join(" · ")}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** "2026/2027" → "2027/2028". A sensible default the VP Admin can still overwrite. */
function suggestNextSession(session: string | null | undefined): string {
    const match = (session ?? "").match(/^(\d{4})\/(\d{4})$/);
    if (!match) return "";
    return `${Number(match[1]) + 1}/${Number(match[2]) + 1}`;
}

function formatWat(iso: string): string {
    return new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(iso));
}
