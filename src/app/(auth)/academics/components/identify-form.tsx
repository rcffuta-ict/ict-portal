"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Loader2, UserCheck } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import { identifyForRoundAction, type RoundIdentity } from "../action";

const schema = z.object({
    email: z.string().trim().min(1, "Enter your email.").email("That isn't an email address."),
    surname: z.string().trim().min(1, "Enter your surname."),
    matric: z.string().trim().min(1, "Enter your matric number."),
});

export type Identified = Extract<Awaited<ReturnType<typeof identifyForRoundAction>>, { ok: true }>;

/**
 * Who's submitting: the details on their fellowship record. Nothing about the member
 * comes back until all three match.
 */
export function IdentifyForm({
    token,
    roundLabel,
    onIdentified,
}: {
    token: string;
    roundLabel: string;
    onIdentified: (identity: RoundIdentity, result: Identified) => void;
}) {
    const id = useId();
    const [serverError, setServerError] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<RoundIdentity>({ resolver: zodResolver(schema), defaultValues: { email: "", surname: "", matric: "" } });

    const onSubmit = async (values: RoundIdentity) => {
        setServerError(null);
        let res: Awaited<ReturnType<typeof identifyForRoundAction>>;
        try {
            res = await identifyForRoundAction(token, values);
        } catch {
            setServerError("Couldn't reach the server. Check your connection and try again.");
            return;
        }
        if (!res.ok) {
            setServerError(res.error);
            return;
        }
        onIdentified(values, res);
    };

    const field = (name: keyof RoundIdentity, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
        <div className="space-y-1">
            <label htmlFor={`${id}-${name}`} className="text-xs font-medium text-gray-700">
                {label}
            </label>
            <FormInput
                id={`${id}-${name}`}
                aria-invalid={!!errors[name]}
                aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
                {...props}
                {...register(name)}
            />
            {errors[name] && (
                <p id={`${id}-${name}-error`} role="alert" className="text-xs text-red-600">
                    {errors[name]?.message}
                </p>
            )}
        </div>
    );

    return (
        <div className="mx-auto w-full max-w-md space-y-6 py-6">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-rcf-navy">
                    <UserCheck className="h-7 w-7" aria-hidden="true" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{roundLabel}</p>
                <h1 className="mt-1 text-2xl font-bold text-rcf-navy">Confirm it&apos;s you</h1>
                <p className="mt-2 text-sm text-slate-500">As they appear on your fellowship record.</p>
            </div>

            <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
            >
                {field("email", "Email", { type: "email", inputMode: "email", autoComplete: "email", placeholder: "you@example.com" })}
                {field("surname", "Surname", { autoComplete: "family-name" })}
                {field("matric", "Matric number", {
                    autoCapitalize: "characters",
                    autoCorrect: "off",
                    spellCheck: false,
                    placeholder: "CSC/21/1234",
                    className: "uppercase",
                })}

                {serverError && (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {serverError}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary flex h-11 w-full items-center justify-center gap-2 disabled:opacity-60"
                >
                    {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    )}
                    {isSubmitting ? "Checking…" : "Continue"}
                </button>
            </form>
        </div>
    );
}
