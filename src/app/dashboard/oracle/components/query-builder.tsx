"use client";

import { useId } from "react";
import { Plus, X, Filter } from "lucide-react";
import {
    ORACLE_FIELDS,
    FIELD_GROUPS,
    OPERATOR_LABELS,
    VALUELESS_OPS,
    getField,
    operatorsFor,
    type Condition,
    type MatchMode,
    type Operator,
} from "../fields";

interface RefOption {
    id: string;
    label: string;
}

export interface RefData {
    zones: RefOption[];
    classSets: RefOption[];
    units: RefOption[];
}

/**
 * The condition editor: a flat list of `field / operator / value` rows joined by a
 * single AND-or-OR toggle.
 *
 * Deliberately ONE level deep — no nested groups. Nested boolean logic is where query
 * builders become unreadable on a phone, and every query this page is actually for
 * ("300 level women in the Media unit") is expressible as a flat AND.
 */
export function QueryBuilder({
    conditions,
    match,
    refData,
    onChange,
    onMatchChange,
    disabled,
}: {
    conditions: Condition[];
    match: MatchMode;
    refData: RefData;
    onChange: (next: Condition[]) => void;
    onMatchChange: (next: MatchMode) => void;
    disabled?: boolean;
}) {
    const groupId = useId();
    const filterable = ORACLE_FIELDS.filter((f) => f.filterable);

    const update = (index: number, patch: Partial<Condition>) => {
        onChange(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    };

    const addCondition = () => {
        onChange([...conditions, { field: "department", op: "contains", value: "" }]);
    };

    const removeCondition = (index: number) => {
        onChange(conditions.filter((_, i) => i !== index));
    };

    /** Ref fields draw their options from the tables they point at. */
    const optionsFor = (key: string): RefOption[] => {
        const field = getField(key);
        if (field?.refSource === "residential_zones") return refData.zones;
        if (field?.refSource === "class_sets") return refData.classSets;
        if (field?.refSource === "units") return refData.units;
        return [];
    };

    return (
        <section
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            aria-labelledby={`${groupId}-heading`}
        >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2
                    id={`${groupId}-heading`}
                    className="flex items-center gap-2 text-sm font-bold text-rcf-navy"
                >
                    <Filter className="h-4 w-4" aria-hidden="true" />
                    Conditions
                </h2>

                {conditions.length > 1 && (
                    <fieldset className="flex items-center gap-2">
                        <legend className="sr-only">How to combine conditions</legend>
                        <span className="text-xs text-slate-500">Match</span>
                        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
                            {(["all", "any"] as MatchMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => onMatchChange(mode)}
                                    aria-pressed={match === mode}
                                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                                        match === mode
                                            ? "bg-rcf-navy text-white"
                                            : "bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    {mode === "all" ? "All" : "Any"}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                )}
            </div>

            {conditions.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No conditions — showing everyone. Add one to narrow the list.
                </p>
            ) : (
                <ul className="space-y-2">
                    {conditions.map((condition, index) => {
                        const field = getField(condition.field);
                        const ops = field ? operatorsFor(field) : [];
                        const needsValue = !VALUELESS_OPS.includes(condition.op);
                        const refOptions = optionsFor(condition.field);

                        return (
                            <li
                                key={index}
                                className="grid gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-center"
                            >
                                {index > 0 && (
                                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 sm:hidden">
                                        {match === "all" ? "and" : "or"}
                                    </span>
                                )}

                                <label className="sr-only" htmlFor={`${groupId}-f-${index}`}>
                                    Field for condition {index + 1}
                                </label>
                                <select
                                    id={`${groupId}-f-${index}`}
                                    value={condition.field}
                                    disabled={disabled}
                                    onChange={(e) => {
                                        const next = getField(e.target.value);
                                        update(index, {
                                            field: e.target.value,
                                            // Keep the operator only if the new field supports it.
                                            op: next && operatorsFor(next).includes(condition.op)
                                                ? condition.op
                                                : (next ? operatorsFor(next)[0] : "is"),
                                            value: "",
                                            value2: "",
                                        });
                                    }}
                                    className="h-11 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-rcf-navy focus:ring-4 focus:ring-blue-500/10"
                                >
                                    {FIELD_GROUPS.map((group) => {
                                        const inGroup = filterable.filter((f) => f.group === group);
                                        if (!inGroup.length) return null;
                                        return (
                                            <optgroup key={group} label={group}>
                                                {inGroup.map((f) => (
                                                    <option key={f.key} value={f.key}>
                                                        {f.label}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        );
                                    })}
                                </select>

                                <label className="sr-only" htmlFor={`${groupId}-o-${index}`}>
                                    Operator for condition {index + 1}
                                </label>
                                <select
                                    id={`${groupId}-o-${index}`}
                                    value={condition.op}
                                    disabled={disabled}
                                    onChange={(e) => update(index, { op: e.target.value as Operator })}
                                    className="h-11 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-rcf-navy focus:ring-4 focus:ring-blue-500/10"
                                >
                                    {ops.map((op) => (
                                        <option key={op} value={op}>
                                            {OPERATOR_LABELS[op]}
                                        </option>
                                    ))}
                                </select>

                                <div className="flex items-center gap-2">
                                    {!needsValue ? (
                                        <span className="text-xs text-slate-400">no value needed</span>
                                    ) : field?.kind === "enum" ? (
                                        <ValueSelect
                                            id={`${groupId}-v-${index}`}
                                            label={`Value for condition ${index + 1}`}
                                            value={condition.value ?? ""}
                                            disabled={disabled}
                                            onChange={(v) => update(index, { value: v })}
                                            options={(field.options ?? []).map((o) => ({ id: o, label: o }))}
                                        />
                                    ) : refOptions.length && condition.op !== "in" ? (
                                        <ValueSelect
                                            id={`${groupId}-v-${index}`}
                                            label={`Value for condition ${index + 1}`}
                                            value={condition.value ?? ""}
                                            disabled={disabled}
                                            onChange={(v) => update(index, { value: v })}
                                            options={refOptions}
                                        />
                                    ) : (
                                        <>
                                            <input
                                                id={`${groupId}-v-${index}`}
                                                aria-label={`Value for condition ${index + 1}`}
                                                type={field?.kind === "date" ? "date" : field?.kind === "number" ? "number" : "text"}
                                                value={condition.value ?? ""}
                                                disabled={disabled}
                                                placeholder={condition.op === "in" ? "comma, separated, values" : "value"}
                                                onChange={(e) => update(index, { value: e.target.value })}
                                                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rcf-navy focus:ring-4 focus:ring-blue-500/10"
                                            />
                                            {condition.op === "between" && (
                                                <input
                                                    aria-label={`Second value for condition ${index + 1}`}
                                                    type={field?.kind === "date" ? "date" : "number"}
                                                    value={condition.value2 ?? ""}
                                                    disabled={disabled}
                                                    onChange={(e) => update(index, { value2: e.target.value })}
                                                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rcf-navy focus:ring-4 focus:ring-blue-500/10"
                                                />
                                            )}
                                        </>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removeCondition(index)}
                                    disabled={disabled}
                                    aria-label={`Remove condition ${index + 1}`}
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <button
                type="button"
                onClick={addCondition}
                disabled={disabled}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-rcf-navy hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-50"
            >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add condition
            </button>
        </section>
    );
}

function ValueSelect({
    id,
    label,
    value,
    options,
    disabled,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    options: RefOption[];
    disabled?: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <>
            <label className="sr-only" htmlFor={id}>{label}</label>
            <select
                id={id}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-rcf-navy focus:ring-4 focus:ring-blue-500/10"
            >
                <option value="">Choose…</option>
                {options.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                ))}
            </select>
        </>
    );
}
