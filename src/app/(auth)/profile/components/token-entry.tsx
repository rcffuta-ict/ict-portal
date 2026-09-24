"use client";

import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, KeyRound, Loader2, PencilLine, UserPlus } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import { parseLevelTokenInput } from "@/lib/level-token";
import { openLevelTokenAction } from "../action";

const schema = z.object({
    token: z
        .string()
        .trim()
        .min(1, "Enter your level token.")
        .refine((v) => parseLevelTokenInput(v) !== null, "That isn't a level token. It looks like RCF-7KX2P."),
    reason: z.enum(["register", "update"]),
});
type Values = z.infer<typeof schema>;

export type OpenedToken = Extract<Awaited<ReturnType<typeof openLevelTokenAction>>, { valid: true }>;

const CHOICES = [
    { value: "register", icon: UserPlus, title: "I'm new", text: "Create my record" },
    { value: "update", icon: PencilLine, title: "I'm registered", text: "Update my details" },
] as const;

/**
 * /profile without a link: type the level token instead.
 *
 * Coordinators share the token itself as often as the link ("our token is RCF-7KX2P"),
 * so the page takes it directly. Any case works, and so does a pasted link. The token is
 * checked on the server before the form opens, so a typo is caught here, under the box,
 * not three steps into registration.
 */
export function TokenEntry({ onOpened }: { onOpened: (opened: OpenedToken, reason: Values["reason"]) => void }) {
    const id = useId();
    const {
        register,
        handleSubmit,
        control,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { token: "", reason: "register" } });
    const reason = useWatch({ control, name: "reason" });

    const onSubmit = async (values: Values) => {
        let res: Awaited<ReturnType<typeof openLevelTokenAction>>;
        try {
            res = await openLevelTokenAction(values.token);
        } catch {
            setError("token", { message: "Couldn't reach the server. Check your connection and try again." });
            return;
        }
        if (!res.valid) {
            setError("token", { message: res.reason });
            return;
        }
        onOpened(res, values.reason);
    };

    return (
        <div className="mx-auto w-full max-w-md space-y-6 py-6">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-rcf-navy">
                    <KeyRound className="h-7 w-7" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-bold text-rcf-navy">Your fellowship record</h1>
                <p className="mt-2 text-sm text-slate-500">
                    Get indexed, or update your details, with the token your level coordinator shared.
                </p>
            </div>

            <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
            >
                <div className="space-y-1">
                    <label htmlFor={`${id}-token`} className="text-xs font-medium text-gray-700">
                        Level token
                    </label>
                    <FormInput
                        id={`${id}-token`}
                        autoComplete="off"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="RCF-XXXXX"
                        aria-invalid={!!errors.token}
                        aria-describedby={errors.token ? `${id}-token-error` : `${id}-token-hint`}
                        className="font-mono uppercase tracking-widest"
                        {...register("token")}
                    />
                    {errors.token ? (
                        <p id={`${id}-token-error`} role="alert" className="text-xs text-red-600">
                            {errors.token.message}
                        </p>
                    ) : (
                        <p id={`${id}-token-hint`} className="text-xs text-slate-400">
                            Capitals or not, either works. You can paste the whole link too.
                        </p>
                    )}
                </div>

                <fieldset>
                    <legend className="mb-2 text-xs font-medium text-gray-700">What do you want to do?</legend>
                    <div className="grid grid-cols-2 gap-2">
                        {CHOICES.map((c) => {
                            const on = reason === c.value;
                            return (
                                <label
                                    key={c.value}
                                    className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rcf-navy ${
                                        on ? "border-rcf-navy bg-rcf-navy/5" : "border-slate-200 hover:border-rcf-navy/40"
                                    }`}
                                >
                                    <input type="radio" value={c.value} className="sr-only" {...register("reason")} />
                                    <c.icon className={`h-5 w-5 ${on ? "text-rcf-navy" : "text-slate-400"}`} aria-hidden="true" />
                                    <span className="text-sm font-bold text-slate-800">{c.title}</span>
                                    <span className="text-xs text-slate-500">{c.text}</span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

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

                <p className="text-center text-xs text-slate-400">
                    No token? Ask your level coordinator.
                </p>
            </form>
        </div>
    );
}
