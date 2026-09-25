"use client";

import { useEffect, useId, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, ChevronDown, Loader2, Send } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import { DepartmentSelect } from "@/components/academics/department-select";
import { useDepartments } from "@/lib/hooks/useDepartments";
import { findDepartment } from "@/lib/departments";
import { parseGrade } from "@/lib/academics";
import { submitResultsAction, type ResultSlot, type RoundIdentity } from "../action";

const GRADE_HINT = "0 to 5, up to two decimals";

const row = z.object({
    session: z.string(),
    semester: z.number(),
    required: z.boolean(),
    gpa: z.string().trim(),
    cgpa: z.string().trim(),
});

const schema = z.object({
    department: z.string().min(1, "Choose your department."),
    rows: z.array(row).superRefine((rows, ctx) => {
        rows.forEach((r, i) => {
            const blank = !r.gpa && !r.cgpa;
            // Earlier semesters are optional: both blank is fine, one of the two is not.
            if (blank && !r.required) return;
            for (const key of ["gpa", "cgpa"] as const) {
                if (!r[key]) ctx.addIssue({ code: "custom", path: [i, key], message: "Required" });
                else if (parseGrade(r[key]) == null) ctx.addIssue({ code: "custom", path: [i, key], message: GRADE_HINT });
            }
        });
    }),
});
type Values = z.infer<typeof schema>;

export type SubmitDone = Extract<Awaited<ReturnType<typeof submitResultsAction>>, { ok: true }>;

/**
 * The semester that just ended, then any earlier semesters still empty.
 *
 * Grades already on record are never shown here, only "Submitted": anyone who knows a
 * member's email, surname and matric number can reach this form, so it mustn't reveal
 * their results.
 */
export function ResultsForm({
    token,
    identity,
    firstName,
    roundLabel,
    department,
    slots,
    onDone,
}: {
    token: string;
    identity: RoundIdentity;
    firstName: string;
    roundLabel: string;
    department: string | null;
    slots: ResultSlot[];
    onDone: (done: SubmitDone) => void;
}) {
    const id = useId();
    const depts = useDepartments();
    const [serverError, setServerError] = useState<string | null>(null);
    const current = slots.find((s) => s.current) ?? null;
    const pastEmpty = slots.filter((s) => !s.current && !s.submitted);
    const pastDone = slots.filter((s) => !s.current && s.submitted);
    const [showPast, setShowPast] = useState(false);

    const editable = [...(current ? [current] : []), ...pastEmpty];
    const {
        register,
        control,
        handleSubmit,
        getValues,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: {
            department: department ?? "",
            rows: editable.map((s) => ({
                session: s.session,
                semester: s.semester,
                // Resubmitting the round's semester is allowed but not required.
                required: s.current && !s.submitted,
                gpa: "",
                cgpa: "",
            })),
        },
    });
    const { fields } = useFieldArray({ control, name: "rows" });

    // A record holding the full department name still preselects its course code.
    useEffect(() => {
        const value = getValues("department");
        const match = findDepartment(value, depts.departments);
        if (match && match.alias !== value) setValue("department", match.alias);
    }, [depts.departments, getValues, setValue]);

    // Open the earlier semesters if one of them failed validation.
    const pastHasError = (errors.rows as unknown[] | undefined)?.some((e, i) => !!e && fields[i] && !editable[i]?.current);
    const pastOpen = showPast || !!pastHasError;

    const onSubmit = async (values: Values) => {
        setServerError(null);
        const entries = values.rows
            .filter((r) => r.gpa && r.cgpa)
            .map((r) => ({ session: r.session, semester: r.semester, gpa: r.gpa, cgpa: r.cgpa }));
        let res: Awaited<ReturnType<typeof submitResultsAction>>;
        try {
            res = await submitResultsAction(token, identity, { entries, department: values.department });
        } catch {
            setServerError("Couldn't reach the server. Nothing was saved; check your connection and try again.");
            return;
        }
        if (!res.ok) {
            setServerError(res.error);
            return;
        }
        onDone(res);
    };

    const gradeInputs = (index: number, label: string) => {
        const rowErr = (errors.rows as Record<string, { gpa?: { message?: string }; cgpa?: { message?: string } }> | undefined)?.[index];
        return (
            <div className="grid grid-cols-2 gap-3">
                {(["gpa", "cgpa"] as const).map((key) => {
                    const err = rowErr?.[key]?.message;
                    const inputId = `${id}-${index}-${key}`;
                    return (
                        <div key={key} className="space-y-1">
                            <label htmlFor={inputId} className="text-xs font-medium text-gray-700">
                                {key.toUpperCase()}
                                <span className="sr-only"> for {label}</span>
                            </label>
                            <FormInput
                                id={inputId}
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder={key === "gpa" ? "4.20" : "4.05"}
                                aria-invalid={!!err}
                                aria-describedby={err ? `${inputId}-error` : undefined}
                                className="font-mono"
                                {...register(`rows.${index}.${key}`)}
                            />
                            {err && (
                                <p id={`${inputId}-error`} role="alert" className="text-xs text-red-600">
                                    {err}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="mx-auto w-full max-w-md space-y-6 py-6">
            <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{roundLabel}</p>
                <h1 className="mt-1 text-2xl font-bold text-rcf-navy">Hi {firstName}</h1>
                <p className="mt-2 text-sm text-slate-500">
                    Enter your results as they are on your result slip, on the 5-point scale.
                </p>
            </div>

            <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
            >
                {current && (
                    <fieldset className="space-y-3">
                        <legend className="text-sm font-bold text-slate-800">{current.label}</legend>
                        {current.submitted && (
                            <p className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                You&apos;ve already submitted this semester. Enter it again only to replace it.
                            </p>
                        )}
                        {gradeInputs(0, current.label)}
                    </fieldset>
                )}

                {(pastEmpty.length > 0 || pastDone.length > 0) && (
                    <div className="rounded-xl border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setShowPast((v) => !v)}
                            aria-expanded={pastOpen}
                            aria-controls={`${id}-past`}
                            className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-bold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                        >
                            <span>
                                Earlier semesters
                                <span className="block text-xs font-normal text-slate-500">
                                    Optional. {pastEmpty.length} not recorded yet.
                                </span>
                            </span>
                            <ChevronDown
                                className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${pastOpen ? "rotate-180" : ""}`}
                                aria-hidden="true"
                            />
                        </button>
                        {pastOpen && (
                            <div id={`${id}-past`} className="space-y-5 border-t border-slate-100 p-3">
                                {fields.map((f, i) => {
                                    const slot = editable[i];
                                    if (!slot || slot.current) return null;
                                    return (
                                        <fieldset key={f.id} className="space-y-2">
                                            <legend className="text-xs font-bold text-slate-600">{slot.label}</legend>
                                            {gradeInputs(i, slot.label)}
                                        </fieldset>
                                    );
                                })}
                                {pastDone.length > 0 && (
                                    <ul className="space-y-1 text-xs text-slate-500">
                                        {pastDone.map((s) => (
                                            <li key={`${s.session}#${s.semester}`} className="flex items-center gap-1.5">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                                                {s.label}: submitted
                                            </li>
                                        ))}
                                        <li className="pt-1">To correct one of these, ask the Academic Unit.</li>
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-1">
                    <label htmlFor={`${id}-dept`} className="text-xs font-medium text-gray-700">
                        Department
                    </label>
                    <DepartmentSelect
                        id={`${id}-dept`}
                        departments={depts.departments}
                        loading={depts.loading}
                        error={depts.error}
                        onRetry={depts.retry}
                        currentValue={department}
                        aria-invalid={!!errors.department}
                        {...register("department")}
                    />
                    {errors.department && (
                        <p role="alert" className="text-xs text-red-600">
                            {errors.department.message}
                        </p>
                    )}
                </div>

                {serverError && (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {serverError}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting || depts.loading}
                    className="btn-primary flex h-11 w-full items-center justify-center gap-2 disabled:opacity-60"
                >
                    {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                        <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                    {isSubmitting ? "Saving…" : "Submit results"}
                </button>
            </form>
        </div>
    );
}
