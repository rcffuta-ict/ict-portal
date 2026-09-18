/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getHandoverPreviewAction, handoverTenureAction, searchMemberAction } from "../actions";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";
import FormInput from "@/components/ui/FormInput";
import { BackupPicker } from "@/components/dashboard/backup-picker";

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
 *   6. Commit           — a summary, then type the session to confirm.
 *
 * On step 3: a member's level is never stored. It is computed from their generation's
 * entry year against the ACTIVE TENURE'S SESSION, so advancing the session moves every
 * generation forward and retires the finalists on its own. Nothing is rewritten, which
 * is exactly why the preview can be trusted as literal.
 */

const STEPS = [
    { id: "backup", label: "Back up", icon: Archive },
    { id: "tenure", label: "New tenure", icon: CalendarDays },
    { id: "progression", label: "Progression", icon: TrendingUp },
    { id: "offices", label: "Offices", icon: UserCheck },
    { id: "aftermath", label: "Everyone else", icon: Settings2 },
    { id: "commit", label: "Hand over", icon: Flag },
] as const;

export function HandoverWizard({
    currentTenure,
}: {
    currentTenure: { id: string; name: string; session: string };
}) {
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        name: "",
        session: suggestNextSession(currentTenure.session),
        startDate: new Date().toISOString().slice(0, 10),
        theme: "",
    });

    const [preview, setPreview] = useState<any>(null);
    const [previewLoading, setPreviewLoading] = useState(true);
    const [previewKey, setPreviewKey] = useState(0);

    const [vpAdmin, setVpAdmin] = useState<any>(null);
    const [ictCoord, setIctCoord] = useState<any>(null);
    const [carryMembership, setCarryMembership] = useState(true);
    const [revokeOutgoing, setRevokeOutgoing] = useState(true);
    const [acknowledged, setAcknowledged] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState<null | { carried: number; revoked: number }>(null);

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
    const losing = preview?.losingAccess ?? [];

    /** Each step's gate. A step can only be left once its own condition is met. */
    const stepComplete = useMemo(
        () => [
            hasBackup,
            !!form.name.trim() && !!session && !!form.startDate,
            acknowledged && !!preview,
            !!vpAdmin && !!ictCoord,
            true, // both options have defaults; there is nothing to get wrong
            confirmText.trim() === session && !!session,
        ],
        [hasBackup, form.name, session, form.startDate, acknowledged, preview, vpAdmin, ictCoord, confirmText],
    );

    const submit = async () => {
        setSubmitting(true);
        const fd = new FormData();
        fd.append("name", form.name.trim());
        fd.append("session", session);
        fd.append("startDate", form.startDate);
        fd.append("theme", form.theme.trim());
        fd.append("vpAdminProfileId", vpAdmin.id);
        fd.append("ictCoordProfileId", ictCoord.id);
        fd.append("carryMembership", carryMembership ? "true" : "false");
        fd.append("revokeOutgoing", revokeOutgoing ? "true" : "false");

        const res = await handoverTenureAction(fd);
        setSubmitting(false);

        if (!res.success) {
            showAlert({
                type: "error",
                title: "Handover failed",
                message: res.error || "Unknown error. Nothing was changed.",
            });
            return;
        }
        setDone({ carried: res.carried ?? 0, revoked: res.revoked ?? 0 });
    };

    if (done) {
        return <HandoverComplete name={form.name} session={session} result={done} />;
    }

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
                            Closing {currentTenure.name}
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
                    <StepRail step={step} complete={stepComplete} onJump={setStep} />
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
                                    <strong>{currentTenure.name}</strong> yet. Download one to continue —
                                an older bundle wouldn&rsquo;t contain this tenure&rsquo;s appointments
                                or transfers.
                                </p>
                            )}

                            <div className="mt-5">
                                <BackupPicker
                                    tenureId={currentTenure.id}
                                    tenureName={currentTenure.name}
                                    presidentName={preview?.presidentName ?? null}
                                    // The download is a navigation, so we can't await it —
                                    // re-check shortly after for the recorded audit row.
                                    onDownloaded={() => setTimeout(refreshPreview, 2500)}
                                />
                            </div>

                        </StepBody>
                    )}

                    {step === 1 && (
                        <StepBody
                            title="The incoming tenure"
                            blurb="The session is the value that re-levels the whole fellowship. Everything else here is a label."
                        >
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormInput
                                    label="Tenure name"
                                    value={form.name}
                                    placeholder="e.g. Dominion"
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
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
                                <FormInput
                                    label="Theme (optional)"
                                    value={form.theme}
                                    onChange={(e) => setForm({ ...form, theme: e.target.value })}
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
                                                </span>
                                            </li>
                                        ))}
                                    </ul>

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
                            blurb="Last look. Nothing has changed yet."
                        >
                            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                                <Row label="Closing">{currentTenure.name} ({currentTenure.session})</Row>
                                <Row label="Opening">{form.name} ({session})</Row>
                                <Row label="VP Admin">{vpAdmin?.first_name} {vpAdmin?.last_name}</Row>
                                <Row label="ICT Coordinator">{ictCoord?.first_name} {ictCoord?.last_name}</Row>
                                <Row label="Becoming alumni">
                                    {graduating.length
                                        ? graduating.map((g: any) => g.familyName || g.entryYear).join(", ")
                                        : "Nobody"}
                                </Row>
                                <Row label="Membership">
                                    {carryMembership ? `${preview?.membershipCount ?? 0} carried forward` : "Not carried — units start empty"}
                                </Row>
                                <Row label="Outgoing access">
                                    {revokeOutgoing ? `${losing.length} login${losing.length === 1 ? "" : "s"} revoked` : "Left in place"}
                                </Row>
                            </dl>

                            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/60 p-4">
                                <h4 className="flex items-center gap-2 text-sm font-bold text-red-800">
                                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                                This cannot be undone
                                </h4>
                                <p className="mt-1 text-xs leading-relaxed text-red-700">
                                Type the incoming session to confirm you mean it.
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
                                    {submitting ? "Handing over…" : `Hand over to ${form.name || "the new tenure"}`}
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
                        onClick={() => setStep((n) => Math.max(0, n - 1))}
                        disabled={step === 0}
                        className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-40"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Back
                    </button>

                    {step < STEPS.length - 1 ? (
                        <button
                            type="button"
                            onClick={() => setStep((n) => Math.min(STEPS.length - 1, n + 1))}
                            disabled={!stepComplete[step]}
                            className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-rcf-navy px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                        >
                            Continue
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
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

function HandoverComplete({
    name,
    session,
    result,
}: {
    name: string;
    session: string;
    result: { carried: number; revoked: number };
}) {
    return (
        <div className="flex min-h-full flex-col items-center justify-center bg-emerald-50 p-6 text-center sm:p-8">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
            <h2 className="mt-3 text-xl font-bold text-emerald-900">
                {name} is now the active tenure
            </h2>
            <p className="mt-1 text-sm text-emerald-800">
                Session {session}. Every generation has advanced.
            </p>

            <dl className="mx-auto mt-5 max-w-sm space-y-1.5 text-left text-sm">
                <div className="flex justify-between gap-4 rounded-lg bg-white/70 px-3 py-2">
                    <dt className="text-emerald-800">Memberships carried</dt>
                    <dd className="font-bold text-emerald-900">{result.carried}</dd>
                </div>
                <div className="flex justify-between gap-4 rounded-lg bg-white/70 px-3 py-2">
                    <dt className="text-emerald-800">Logins revoked</dt>
                    <dd className="font-bold text-emerald-900">{result.revoked}</dd>
                </div>
            </dl>

            <p className="mx-auto mt-5 max-w-md text-xs leading-relaxed text-emerald-800">
                Next: fill the cabinet from the Tenure Manager. Every position except VP Admin
                and ICT Coordinator is currently vacant, and appointing someone restores their
                portal access automatically.
            </p>

            <a
                href="/dashboard/tenure"
                className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
                Back to Tenure Manager
            </a>
        </div>
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
                    <span className="min-w-0 truncate text-sm font-medium text-emerald-900">
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
                                className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
                            >
                                <span className="text-sm font-medium text-slate-800">
                                    {m.first_name} {m.last_name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                    {[m.email, m.level].filter(Boolean).join(" · ")}
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
