"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Copy, Loader2, Lock, Megaphone, Plus, Share2, Unlock } from "lucide-react";
import { format } from "date-fns";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";
import FormSelect from "@/components/ui/FormSelect";
import FormInput from "@/components/ui/FormInput";
import { SEMESTER_NAMES, isValidSession, sessionFor } from "@/lib/academics";
import { sessionStartYear } from "@/lib/levels";
import { displayLevelToken, resultsPath } from "@/lib/level-token";
import type { AcademicRound } from "@/lib/academics-db";
import { openResultsRoundAction, setRoundOpenAction } from "../actions";

const schema = z.object({
    session: z.string().refine(isValidSession, "Pick a session."),
    semester: z.enum(["1", "2"]),
    closesAt: z.string().optional(),
});
type Values = z.infer<typeof schema>;

function shareText(round: AcademicRound, origin: string) {
    const token = displayLevelToken(round.token);
    const due = round.closesAt ? ` by ${format(new Date(round.closesAt), "EEE d MMM")}` : "";
    return (
        `RCF FUTA Academic Unit: please submit your ${round.label} results (GPA and CGPA)${due}.\n` +
        `${origin}${resultsPath(round.token)}\n` +
        `Round token: ${token}`
    );
}

/**
 * Results rounds: open one per semester, share its link, close it when the semester's
 * collection is done. One open at a time (the database enforces it too).
 */
export function RoundsPanel({
    rounds,
    canWrite,
    activeSession,
}: {
    rounds: AcademicRound[];
    canWrite: boolean;
    activeSession: string | null;
}) {
    const router = useRouter();
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();
    const open = rounds.find((r) => r.isOpen) ?? null;

    const toggle = (round: AcademicRound, next: boolean) => {
        showAlert({
            type: "warning",
            title: next ? "Reopen round?" : "Close round?",
            message: next
                ? `Members will be able to submit ${round.label} results again.`
                : `Members won't be able to submit ${round.label} results any more. You can reopen it later.`,
            confirmText: next ? "Reopen" : "Close round",
            onConfirm: async () => {
                try {
                    const res = await setRoundOpenAction(round.id, next);
                    if (!res.success) {
                        showAlert({ type: "error", message: res.error });
                        return;
                    }
                    router.refresh();
                } catch {
                    showAlert({ type: "error", message: "Couldn't reach the server. Try again." });
                }
            },
        });
    };

    return (
        <div className="space-y-5">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {open ? (
                <OpenRoundCard round={open} canWrite={canWrite} onClose={() => toggle(open, false)} />
            ) : canWrite ? (
                <OpenRoundForm activeSession={activeSession} rounds={rounds} onOpened={() => router.refresh()} />
            ) : (
                <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
                    No round is open.
                </p>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <h4 className="mb-3 font-bold text-slate-700">All rounds</h4>
                {rounds.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">None yet.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {rounds.map((r) => (
                            <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-slate-800">{r.label}</p>
                                    <p className="text-xs text-slate-500">
                                        <span className="font-mono">{displayLevelToken(r.token)}</span> · opened{" "}
                                        {format(new Date(r.opensAt), "d MMM yyyy")}
                                        {r.closedAt && ` · closed ${format(new Date(r.closedAt), "d MMM yyyy")}`}
                                    </p>
                                </div>
                                {r.isOpen ? (
                                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                                        Open
                                    </span>
                                ) : canWrite && !open ? (
                                    <button
                                        type="button"
                                        onClick={() => toggle(r, true)}
                                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                    >
                                        <Unlock className="h-3.5 w-3.5" aria-hidden="true" /> Reopen
                                    </button>
                                ) : (
                                    <span className="shrink-0 text-[10px] font-bold uppercase text-slate-400">Closed</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function OpenRoundCard({ round, canWrite, onClose }: { round: AcademicRound; canWrite: boolean; onClose: () => void }) {
    const [copied, setCopied] = useState<"link" | "message" | null>(null);
    const [copyError, setCopyError] = useState<string | null>(null);

    const copy = async (what: "link" | "message") => {
        setCopyError(null);
        const origin = window.location.origin;
        try {
            await navigator.clipboard.writeText(what === "link" ? `${origin}${resultsPath(round.token)}` : shareText(round, origin));
            setCopied(what);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            setCopyError("Couldn't copy. Select the token and copy it by hand.");
        }
    };

    const share = async () => {
        const text = shareText(round, window.location.origin);
        if (navigator.share) {
            try {
                await navigator.share({ text });
                return;
            } catch {
                // Cancelled, or not allowed: fall through to WhatsApp.
            }
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    };

    return (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
                        <Megaphone className="h-4 w-4" aria-hidden="true" /> Open round
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-slate-800">{round.label}</h3>
                    {round.closesAt && (
                        <p className="text-xs text-slate-500">Due {format(new Date(round.closesAt), "EEEE d MMMM")}</p>
                    )}
                </div>
                <p className="rounded-xl bg-white px-4 py-2 font-mono text-xl font-bold tracking-widest text-rcf-navy shadow-sm select-all">
                    {displayLevelToken(round.token)}
                </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                    type="button"
                    onClick={share}
                    className="btn-primary flex h-11 items-center justify-center gap-2"
                >
                    <Share2 className="h-4 w-4" aria-hidden="true" /> Share
                </button>
                <button
                    type="button"
                    onClick={() => copy("message")}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                >
                    {copied === "message" ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                    {copied === "message" ? "Copied" : "Copy message"}
                </button>
                <button
                    type="button"
                    onClick={() => copy("link")}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                >
                    {copied === "link" ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                    {copied === "link" ? "Copied" : "Copy link"}
                </button>
            </div>
            {copyError && (
                <p role="alert" className="mt-2 text-xs text-red-600">
                    {copyError}
                </p>
            )}
            <p className="mt-3 text-xs text-slate-500">
                Who hasn&apos;t submitted is on the Overview tab, under &ldquo;Not submitted&rdquo;, with a CSV export for chasing.
            </p>

            {canWrite && (
                <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                    <Lock className="h-4 w-4" aria-hidden="true" /> Close round
                </button>
            )}
        </section>
    );
}

function OpenRoundForm({
    activeSession,
    rounds,
    onOpened,
}: {
    activeSession: string | null;
    rounds: AcademicRound[];
    onOpened: () => void;
}) {
    const id = useId();
    const start = sessionStartYear(activeSession) ?? new Date().getFullYear();
    const sessions = [start + 1, start, start - 1, start - 2].map(sessionFor);
    const taken = new Set(rounds.map((r) => `${r.session}#${r.semester}`));
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        control,
        formState: { errors, isSubmitting },
    } = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { session: sessionFor(start), semester: "1", closesAt: "" },
    });
    const session = useWatch({ control, name: "session" });
    const semester = useWatch({ control, name: "semester" });
    const clash = taken.has(`${session}#${semester}`);

    const onSubmit = async (v: Values) => {
        setServerError(null);
        try {
            const res = await openResultsRoundAction({
                session: v.session,
                semester: Number(v.semester),
                closesAt: v.closesAt ? `${v.closesAt}T23:59:00` : null,
            });
            if (!res.success) {
                setServerError(res.error);
                return;
            }
            onOpened();
        } catch {
            setServerError("Couldn't reach the server. Nothing was opened; try again.");
        }
    };

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
            <div>
                <h4 className="flex items-center gap-2 font-bold text-slate-700">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Open a round
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                    Pick the semester whose results you&apos;re collecting. Members then get one link for it.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                    <label htmlFor={`${id}-session`} className="text-xs font-medium text-gray-700">Session</label>
                    <FormSelect id={`${id}-session`} {...register("session")}>
                        {sessions.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </FormSelect>
                </div>
                <fieldset className="space-y-1">
                    <legend className="text-xs font-medium text-gray-700">Semester</legend>
                    <div className="grid grid-cols-2 gap-2">
                        {(["1", "2"] as const).map((s) => (
                            <label
                                key={s}
                                className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-sm font-bold text-slate-600 has-[:checked]:border-rcf-navy has-[:checked]:bg-rcf-navy/5 has-[:checked]:text-rcf-navy has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rcf-navy"
                            >
                                <input type="radio" value={s} className="sr-only" {...register("semester")} />
                                {SEMESTER_NAMES[Number(s) as 1 | 2]}
                            </label>
                        ))}
                    </div>
                </fieldset>
                <div className="space-y-1">
                    <label htmlFor={`${id}-closes`} className="text-xs font-medium text-gray-700">Due date (optional)</label>
                    <FormInput id={`${id}-closes`} type="date" {...register("closesAt")} />
                </div>
            </div>

            {errors.session && <p role="alert" className="text-xs text-red-600">{errors.session.message}</p>}
            {clash && (
                <p className="text-xs text-amber-700">
                    There&apos;s already a round for that semester. Reopen it from the list below instead.
                </p>
            )}
            {serverError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {serverError}
                </p>
            )}

            <button
                type="submit"
                disabled={isSubmitting || clash}
                className="btn-primary flex h-11 w-full items-center justify-center gap-2 disabled:opacity-60 sm:w-auto sm:px-6"
            >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Megaphone className="h-4 w-4" aria-hidden="true" />}
                {isSubmitting ? "Opening…" : "Open round"}
            </button>
        </form>
    );
}
