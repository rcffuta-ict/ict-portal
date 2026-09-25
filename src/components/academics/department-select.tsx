"use client";

import { forwardRef, useMemo } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import FormSelect from "@/components/ui/FormSelect";
import type { DepartmentOption } from "@/lib/departments";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
    /** From useDepartments(). */
    departments: DepartmentOption[];
    loading: boolean;
    error: string | null;
    onRetry: () => void;
    /** The stored value, so a retired department can still be shown as selected. */
    currentValue?: string | null;
};

/**
 * The department picker, grouped by school, from the Academic Unit's list.
 *
 * Renders the <select> only once the list has arrived: react-hook-form sets a
 * registered select's value when it mounts, and a value whose <option> isn't there yet
 * is silently dropped. Retired departments are offered only when they are already the
 * member's, so a record isn't changed just by opening the form.
 */
export const DepartmentSelect = forwardRef<HTMLSelectElement, Props>(function DepartmentSelect(
    { departments, loading, error, onRetry, currentValue, ...selectProps },
    ref,
) {
    const groups = useMemo(() => {
        const current = currentValue?.toUpperCase() ?? null;
        const shown = departments.filter((d) => d.isActive || d.alias === current);
        const byFaculty = new Map<string, DepartmentOption[]>();
        for (const d of shown) {
            const key = d.facultyName ?? d.facultyCode;
            byFaculty.set(key, [...(byFaculty.get(key) ?? []), d]);
        }
        return [...byFaculty.entries()].sort(([a], [b]) => a.localeCompare(b));
    }, [departments, currentValue]);

    if (loading) {
        return (
            <p className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm text-slate-500" role="status">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Loading departments…
            </p>
        );
    }
    if (error) {
        return (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <p>{error}</p>
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-1 inline-flex items-center gap-1 font-bold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                </button>
            </div>
        );
    }

    return (
        <FormSelect ref={ref} {...selectProps}>
            <option value="">Select department</option>
            {groups.map(([faculty, list]) => (
                <optgroup key={faculty} label={faculty}>
                    {list.map((d) => (
                        <option key={d.id} value={d.alias}>
                            {d.name}
                            {d.isActive ? "" : " (retired)"}
                        </option>
                    ))}
                </optgroup>
            ))}
        </FormSelect>
    );
});
