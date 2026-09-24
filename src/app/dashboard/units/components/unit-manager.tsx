/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addWorkerAction, getUnitDetailsAction, removeWorkerAction } from "../actions";
import { Search, UserPlus, Trash2, Mail, Phone, User, Info, Loader2, RefreshCw } from "lucide-react";
import { isGenderCategoryUnit } from "@/config/fellowship-units";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";

const addSchema = z.object({
    email: z.string().trim().min(1, "Enter the member's email.").email("That isn't a valid email address."),
});
type AddValues = z.infer<typeof addSchema>;

/**
 * One unit's roster: load, add, remove.
 *
 * Loads its own members rather than taking them as a prop. It used to copy an
 * `initialMembers` prop into state once — but the parent mounted it before the fetch
 * came back, so the copy was always the empty list and a unit's members never showed.
 *
 * `readOnly` is for the President, who sees every unit but is write-blocked. The server
 * refuses writes regardless; hiding the controls just avoids offering a button that
 * always fails.
 */
export function UnitManager({
    unit,
    readOnly = false,
    onChanged,
}: {
    unit: { id: string; name: string; slug?: string | null };
    readOnly?: boolean;
    /** Called after a successful add/remove, so the parent can refresh its counts. */
    onChanged?: () => void;
}) {
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    // Brothers'/Sisters': the roster is computed from gender, so there is nothing here
    // to add to or remove from.
    const isDerived = isGenderCategoryUnit(unit.slug ?? null);
    const canEdit = !readOnly && !isDerived;

    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<AddValues>({ resolver: zodResolver(addSchema) });

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        const res = await getUnitDetailsAction(unit.id);
        if (res.success) setMembers(res.data);
        else setLoadError(res.error || "Couldn't load this roster.");
        setLoading(false);
    }, [unit.id]);

    useEffect(() => {
        // Deferred a tick so the fetch's setState calls happen outside the effect body.
        const t = setTimeout(load, 0);
        return () => clearTimeout(t);
    }, [load]);

    const onAdd = async (values: AddValues) => {
        const fd = new FormData();
        fd.append("unitId", unit.id);
        fd.append("email", values.email);

        const res = await addWorkerAction(fd);
        if (!res.success) {
            // Inline, on the field it is about — not only in a popup.
            setError("email", { message: res.error || "Couldn't add that member." });
            return;
        }
        reset();
        showAlert({
            type: "success",
            message: (res as any).pendingTransfer
                ? (res as any).message
                : "Worker added.",
        });
        await load();
        onChanged?.();
    };

    const handleRemove = (membershipId: string, who: string) => {
        showAlert({
            type: "warning",
            title: "Remove worker?",
            message: `Remove ${who} from ${unit.name}?`,
            confirmText: "Remove",
            onConfirm: async () => {
                const res = await removeWorkerAction(membershipId);
                if (!res.success) {
                    showAlert({ type: "error", message: res.error || "Couldn't remove that member." });
                    return;
                }
                await load();
                onChanged?.();
            },
        });
    };

    const q = search.toLowerCase();
    const filtered = members.filter(
        (m: any) =>
            (m.first_name ?? "").toLowerCase().includes(q) ||
            (m.last_name ?? "").toLowerCase().includes(q),
    );

    const emailId = `add-worker-email-${unit.id}`;

    return (
        <div className="space-y-5">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {isDerived ? (
                <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                    <div className="text-xs leading-relaxed text-blue-900">
                        <p className="font-bold">This list is not edited — it is counted.</p>
                        <p className="mt-1 text-blue-800">
                            Every member of the fellowship is in {unit.name} by gender, so
                            there is no induction and no roster to curate. To correct
                            somebody&apos;s membership, correct their gender on their profile.
                        </p>
                    </div>
                </div>
            ) : canEdit ? (
                <form
                    onSubmit={handleSubmit(onAdd)}
                    noValidate
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                    <label
                        htmlFor={emailId}
                        className="text-[11px] font-bold uppercase tracking-wide text-slate-500"
                    >
                        Add a worker by email
                    </label>
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                        <input
                            id={emailId}
                            type="email"
                            inputMode="email"
                            autoComplete="off"
                            placeholder="member@example.com"
                            aria-invalid={!!errors.email}
                            aria-describedby={errors.email ? `${emailId}-error` : undefined}
                            {...register("email")}
                            className={`h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rcf-navy/20 ${
                                errors.email ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-rcf-navy"
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
                            {isSubmitting ? "Adding…" : "Add"}
                        </button>
                    </div>
                    {errors.email && (
                        <p id={`${emailId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                            {errors.email.message}
                        </p>
                    )}
                </form>
            ) : null}

            {/* List header — stacks on a phone so the filter never pushes off-screen. */}
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-bold text-slate-700">
                    {isDerived ? "Members" : "Workforce list"}
                    {!loading && !loadError && (
                        <span className="ml-1.5 text-xs font-medium text-slate-400">({members.length})</span>
                    )}
                </h3>
                <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter list…"
                        aria-label={`Filter ${unit.name} members`}
                        className="h-9 w-full rounded-lg bg-slate-50 pl-8 text-xs outline-none focus:ring-1 focus:ring-rcf-navy"
                    />
                </div>
            </div>

            {loading ? (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Loading members…
                </p>
            ) : loadError ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p>{loadError}</p>
                    <button
                        type="button"
                        onClick={load}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-red-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                    </button>
                </div>
            ) : (
                <ul className="space-y-2">
                    {filtered.map((m: any) => {
                        const who = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "this member";
                        return (
                            <li
                                key={m.membershipId || m.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                                        {m.avatar_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={m.avatar_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                                        ) : (
                                            `${m.first_name?.[0] ?? ""}${m.last_name?.[0] ?? ""}`
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <Link
                                            href={`/dashboard/units/${unit.id}/member/${m.id}`}
                                            className="block truncate text-sm font-bold text-slate-900 hover:text-rcf-navy hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                        >
                                            {who}
                                        </Link>
                                        <div className="flex flex-col text-[11px] text-slate-500 sm:flex-row sm:gap-3">
                                            {m.email && (
                                                <a href={`mailto:${m.email}`} className="flex min-w-0 items-center gap-1 hover:text-rcf-navy">
                                                    <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                    <span className="truncate">{m.email}</span>
                                                </a>
                                            )}
                                            {m.phone_number && (
                                                <a href={`tel:${m.phone_number}`} className="flex items-center gap-1 hover:text-rcf-navy">
                                                    <Phone className="h-3 w-3 shrink-0" aria-hidden="true" /> {m.phone_number}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <span className="hidden rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 sm:inline">
                                        {m.role}
                                    </span>
                                    {canEdit && !m.derived && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(m.membershipId, who)}
                                            aria-label={`Remove ${who}`}
                                            className="rounded-full p-2.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}

                    {filtered.length === 0 && (
                        <li className="rounded-xl border-2 border-dashed border-slate-100 py-12 text-center text-sm text-slate-400">
                            <User className="mx-auto mb-2 h-8 w-8 opacity-20" aria-hidden="true" />
                            {search
                                ? "Nobody matches that filter."
                                : isDerived
                                    ? "No member is recorded with this gender yet."
                                    : "No members in this unit yet."}
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
