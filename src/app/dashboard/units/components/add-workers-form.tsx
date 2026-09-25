"use client";

import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Loader2, MinusCircle, UserPlus, X, XCircle } from "lucide-react";
import { addWorkersAction, type AddWorkersResult } from "../actions";
import { MAX_EMAILS_PER_ADD, parseEmailList } from "@/lib/email-list";

const schema = z.object({
    emails: z.string().superRefine((raw, ctx) => {
        const { emails } = parseEmailList(raw);
        if (emails.length === 0) {
            ctx.addIssue({
                code: "custom",
                message: raw.trim() ? "No valid email address found in that." : "Enter at least one email address.",
            });
        } else if (emails.length > MAX_EMAILS_PER_ADD) {
            ctx.addIssue({ code: "custom", message: `Add at most ${MAX_EMAILS_PER_ADD} at a time (that's ${emails.length}).` });
        }
    }),
});
type Values = z.infer<typeof schema>;

/**
 * Add workers by email: one, or a whole pasted list.
 *
 * One box for both, so a single add is as quick as it always was. Paste anything with
 * addresses in it (a spreadsheet column, a WhatsApp list, an email's To: line) and it
 * finds them; the count under the box shows what it found before anything is sent.
 *
 * After a send, every address gets an outcome. The addresses that found no member stay
 * in the box, so a typo can be fixed and resent without retyping the rest.
 */
export function AddWorkersForm({
    unitId,
    unitName,
    onAdded,
}: {
    unitId: string;
    unitName: string;
    /** Called when anyone was added or sent for transfer, so the roster reloads. */
    onAdded: () => void;
}) {
    const id = useId();
    const [result, setResult] = useState<AddWorkersResult | null>(null);
    const {
        register,
        handleSubmit,
        control,
        setValue,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { emails: "" } });

    const raw = useWatch({ control, name: "emails" }) ?? "";
    const parsed = parseEmailList(raw);
    const count = parsed.emails.length;

    const onSubmit = async (values: Values) => {
        setResult(null);
        let res: AddWorkersResult;
        try {
            res = await addWorkersAction(unitId, values.emails);
        } catch {
            setError("emails", { message: "Couldn't reach the server. Check your connection and try again." });
            return;
        }
        if (!res.success) {
            setError("emails", { message: res.error || "Couldn't add those members." });
            return;
        }
        setResult(res);
        // Keep only what still needs attention.
        setValue("emails", [...res.notFound, ...res.invalid].join("\n"));
        if (res.added.length || res.transfers.length) onAdded();
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Add workers by email
            </label>
            <p id={`${id}-hint`} className="mt-0.5 text-xs text-slate-500">
                One address, or paste a list: one per line, or separated by commas or spaces.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                <textarea
                    id={id}
                    rows={raw.includes("\n") || count > 1 ? 4 : 1}
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="member@example.com"
                    aria-invalid={!!errors.emails}
                    aria-describedby={`${id}-hint ${id}-count${errors.emails ? ` ${id}-error` : ""}`}
                    {...register("emails")}
                    onKeyDown={(e) => {
                        // Enter sends a single address, as the old one-line box did;
                        // Shift+Enter starts a new line. Ctrl/Cmd+Enter always sends.
                        if (e.key !== "Enter") return;
                        if (e.ctrlKey || e.metaKey || (!e.shiftKey && !e.currentTarget.value.includes("\n"))) {
                            e.preventDefault();
                            e.currentTarget.form?.requestSubmit();
                        }
                    }}
                    className={`min-h-11 w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm leading-5 outline-none focus:ring-2 focus:ring-rcf-navy/20 ${
                        errors.emails ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-rcf-navy"
                    }`}
                />
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-rcf-navy px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                    )}
                    {isSubmitting ? "Adding…" : count > 1 ? `Add ${count}` : "Add"}
                </button>
            </div>

            <p id={`${id}-count`} aria-live="polite" className="mt-1.5 text-xs text-slate-500">
                {count > 1 && `${count} addresses found.`}
                {parsed.invalid.length > 0 && (
                    <span className="text-amber-700">
                        {count > 1 ? " " : ""}Not an address: {parsed.invalid.join(", ")}
                    </span>
                )}
            </p>
            {errors.emails && (
                <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
                    {errors.emails.message}
                </p>
            )}

            {result && <Outcome result={result} unitName={unitName} onDismiss={() => setResult(null)} />}
        </form>
    );
}

/** What happened to each address, grouped, most useful first. */
function Outcome({ result, unitName, onDismiss }: { result: AddWorkersResult; unitName: string; onDismiss: () => void }) {
    const groups = [
        {
            key: "added",
            show: result.added.length > 0,
            icon: CheckCircle2,
            tone: "text-emerald-700",
            title: `Added to ${unitName} (${result.added.length})`,
            items: result.added,
        },
        {
            key: "transfers",
            show: result.transfers.length > 0,
            icon: ArrowRightLeft,
            tone: "text-sky-700",
            title: `Sent to the VP Admin for transfer (${result.transfers.length})`,
            note: "They're in another unit and stay there until the VP Admin approves the move.",
            items: result.transfers.map((t) => `${t.name} (from ${t.from})`),
        },
        {
            key: "skipped",
            show: result.skipped.length > 0,
            icon: MinusCircle,
            tone: "text-slate-600",
            title: `Nothing to do (${result.skipped.length})`,
            items: result.skipped.map((s) => `${s.name}: ${s.reason}`),
        },
        {
            key: "notFound",
            show: result.notFound.length > 0,
            icon: AlertTriangle,
            tone: "text-amber-700",
            title: `No member with this email (${result.notFound.length})`,
            note: "Check the spelling; they're left in the box to fix. Someone who hasn't registered yet needs to register first.",
            items: result.notFound,
        },
        {
            key: "failed",
            show: result.failed.length > 0,
            icon: XCircle,
            tone: "text-red-700",
            title: `Couldn't add (${result.failed.length})`,
            items: result.failed.map((f) => `${f.name}: ${f.error}`),
        },
    ].filter((g) => g.show);

    return (
        <div role="status" className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-slate-700">Result</p>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss result"
                    className="-m-1 rounded p-1 text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-rcf-navy"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
            <ul className="mt-2 space-y-3">
                {groups.map((g) => (
                    <li key={g.key}>
                        <p className={`flex items-center gap-1.5 text-xs font-bold ${g.tone}`}>
                            <g.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {g.title}
                        </p>
                        {g.note && <p className="mt-0.5 text-[11px] text-slate-500">{g.note}</p>}
                        <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto pl-5 text-xs text-slate-600">
                            {g.items.map((item, i) => (
                                <li key={`${i}-${item}`} className="break-all">{item}</li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
        </div>
    );
}
