"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Save, Loader2, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";
import { updateMemberAction, updateMembershipAction } from "../actions";
import {
    ORACLE_FIELDS,
    FIELD_GROUPS,
    EDITABLE_FIELDS,
    type OracleField,
} from "../fields";
import type { RefData } from "./query-builder";

/**
 * Edit one member's record.
 *
 * Locked fields (email, matric number, profile id) are rendered as DISABLED INPUTS with
 * their reason underneath — not hidden. The admin should be able to see the value and
 * understand why it can't be changed here, rather than wonder where it went.
 *
 * The client can only ever submit fields the registry marks `editable`, and the server
 * re-checks every key against that same registry before building the update. The form
 * below is a convenience, never the boundary.
 */
export function MemberEditor({
    profileId,
    row,
    refData,
    unitId,
    teamIds,
    canWrite,
}: {
    profileId: string;
    row: Record<string, unknown>;
    refData: RefData;
    unitId: string | null;
    teamIds: string[];
    canWrite: boolean;
}) {
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();
    const [serverError, setServerError] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);

    const defaults: Record<string, string> = {};
    for (const f of ORACLE_FIELDS) {
        if (!f.column) continue;
        const v = row[f.column];
        defaults[f.key] =
            v === null || v === undefined
                ? ""
                : f.kind === "date"
                    ? String(v).slice(0, 10) // <input type="date"> wants YYYY-MM-DD
                    : String(v);
    }

    const {
        register,
        handleSubmit,
        reset,
        formState: { isSubmitting, isDirty, errors },
    } = useForm({ mode: "onBlur", defaultValues: defaults });

    // Membership is a separate write (it lives in membership_units, not profiles).
    const [unit, setUnit] = useState<string>(unitId ?? "");
    const [teams, setTeams] = useState<string[]>(teamIds);
    const [savingMembership, setSavingMembership] = useState(false);

    const onSubmit = async (data: Record<string, string>) => {
        setServerError(null);
        setSaved(null);

        // Only send fields the registry says are writable — the server rejects anything
        // else outright, so sending them would just produce a confusing error.
        const patch: Record<string, unknown> = {};
        for (const f of EDITABLE_FIELDS) {
            if (f.key in data) patch[f.key] = data[f.key];
        }

        const res = await updateMemberAction(profileId, patch);
        if (!res.success) {
            setServerError(res.error);
            return;
        }
        reset(data); // the saved values become the new baseline, clearing `isDirty`
        setSaved(
            res.changed === 0
                ? "No changes to save."
                : `Saved ${res.changed} change${res.changed === 1 ? "" : "s"}.`,
        );
    };

    const onSaveMembership = async () => {
        setSavingMembership(true);
        setServerError(null);
        setSaved(null);
        const res = await updateMembershipAction(profileId, {
            unitId: unit || null,
            teamIds: teams,
        });
        setSavingMembership(false);
        if (!res.success) {
            setServerError(res.error);
            return;
        }
        showAlert({
            type: "success",
            title: "Membership updated",
            message:
                res.changed === 0
                    ? "Nothing changed."
                    : `${res.changed} membership change${res.changed === 1 ? "" : "s"} saved.`,
        });
    };

    const units = refData.units.filter((u) => !u.label.endsWith("(team)"));
    const teamOptions = refData.units.filter((u) => u.label.endsWith("(team)"));

    const optionsFor = (field: OracleField) => {
        if (field.refSource === "residential_zones") return refData.zones;
        if (field.refSource === "class_sets") return refData.classSets;
        if (field.refSource === "units") return refData.units;
        return [];
    };

    return (
        <>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {FIELD_GROUPS.filter((g) => g !== "Fellowship").map((group) => {
                    const inGroup = ORACLE_FIELDS.filter(
                        (f) => f.group === group && f.column,
                    );
                    if (!inGroup.length) return null;

                    return (
                        <fieldset
                            key={group}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                            <legend className="px-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                {group}
                            </legend>

                            <div className="grid gap-4 sm:grid-cols-2">
                                {inGroup.map((field) => {
                                    const id = `oracle-${field.key}`;
                                    const locked = !field.editable || !canWrite;
                                    const options = optionsFor(field);

                                    return (
                                        <div key={field.key} className="space-y-1">
                                            <label
                                                htmlFor={id}
                                                className="ml-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"
                                            >
                                                {field.label}
                                                {locked && (
                                                    <Lock
                                                        className="h-3 w-3 text-slate-400"
                                                        aria-label="Read-only"
                                                    />
                                                )}
                                            </label>

                                            {field.kind === "enum" ? (
                                                <select
                                                    id={id}
                                                    disabled={locked}
                                                    {...register(field.key)}
                                                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition-all focus:border-rcf-navy focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-500"
                                                >
                                                    <option value="">Not set</option>
                                                    {(field.options ?? []).map((o) => (
                                                        <option key={o} value={o}>
                                                            {o}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : field.kind === "ref" && options.length ? (
                                                <select
                                                    id={id}
                                                    disabled={locked}
                                                    {...register(field.key)}
                                                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition-all focus:border-rcf-navy focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-500"
                                                >
                                                    <option value="">Not set</option>
                                                    {options.map((o) => (
                                                        <option key={o.id} value={o.id}>
                                                            {o.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    id={id}
                                                    type={
                                                        field.kind === "date"
                                                            ? "date"
                                                            : field.kind === "number"
                                                                ? "number"
                                                                : "text"
                                                    }
                                                    disabled={locked}
                                                    aria-describedby={
                                                        field.lockReason || field.hint
                                                            ? `${id}-help`
                                                            : undefined
                                                    }
                                                    {...register(field.key, {
                                                        validate: (v: string) => {
                                                            if (!v) return true;
                                                            if (field.kind === "number" && !Number.isFinite(Number(v))) {
                                                                return `${field.label} must be a number.`;
                                                            }
                                                            return true;
                                                        },
                                                    })}
                                                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition-all focus:border-rcf-navy focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-500"
                                                />
                                            )}

                                            {(field.lockReason || field.hint) && (
                                                <p
                                                    id={`${id}-help`}
                                                    className="ml-1 text-[11px] leading-snug text-slate-400"
                                                >
                                                    {locked && field.lockReason
                                                        ? field.lockReason
                                                        : field.hint}
                                                </p>
                                            )}

                                            {errors[field.key] && (
                                                <p role="alert" className="ml-1 text-[11px] font-medium text-red-600">
                                                    {String(errors[field.key]?.message)}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </fieldset>
                    );
                })}

                {serverError && (
                    <p
                        role="alert"
                        className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        {serverError}
                    </p>
                )}

                {saved && (
                    <p
                        role="status"
                        className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                    >
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {saved}
                    </p>
                )}

                {canWrite && (
                    <div className="safe-bottom sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
                        <button
                            type="submit"
                            disabled={isSubmitting || !isDirty}
                            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rcf-navy px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-50 sm:w-auto"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Save className="h-4 w-4" aria-hidden="true" />
                            )}
                            {isSubmitting ? "Saving…" : "Save changes"}
                        </button>
                    </div>
                )}
            </form>

            {/* Membership lives in its own table, so it saves separately. */}
            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Fellowship
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                        <label
                            htmlFor="oracle-unit"
                            className="ml-1 text-xs font-bold uppercase tracking-wide text-slate-500"
                        >
                            Unit
                        </label>
                        <select
                            id="oracle-unit"
                            value={unit}
                            disabled={!canWrite}
                            onChange={(e) => setUnit(e.target.value)}
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-rcf-navy focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100"
                        >
                            <option value="">No unit</option>
                            {units.map((u) => (
                                <option key={u.id} value={u.id}>{u.label}</option>
                            ))}
                        </select>
                    </div>

                    <fieldset className="space-y-1">
                        <legend className="ml-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                            Teams
                        </legend>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {teamOptions.length === 0 && (
                                <p className="text-xs text-slate-400">No teams defined.</p>
                            )}
                            {teamOptions.map((t) => {
                                const on = teams.includes(t.id);
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        disabled={!canWrite}
                                        aria-pressed={on}
                                        onClick={() =>
                                            setTeams((prev) =>
                                                on ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                                            )
                                        }
                                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-50 ${
                                            on
                                                ? "border-rcf-navy bg-rcf-navy text-white"
                                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                        }`}
                                    >
                                        {t.label.replace(" (team)", "")}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>
                </div>

                {canWrite && (
                    <button
                        type="button"
                        onClick={onSaveMembership}
                        disabled={savingMembership}
                        className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-rcf-navy transition-colors hover:border-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-60"
                    >
                        {savingMembership && (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        )}
                        Save membership
                    </button>
                )}
            </section>

            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />
        </>
    );
}
