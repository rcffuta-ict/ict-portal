"use client";

import { useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, BookOpen, Loader2 } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import { parseRoundTokenInput } from "@/lib/level-token";
import { openRoundAction } from "../action";

const schema = z.object({
    token: z
        .string()
        .trim()
        .min(1, "Enter the round token.")
        .refine((v) => parseRoundTokenInput(v) !== null, "That isn't a round token. It looks like ACD-7KX2P."),
});
type Values = z.infer<typeof schema>;

export type OpenedRound = Extract<Awaited<ReturnType<typeof openRoundAction>>, { valid: true }>;

/**
 * /academics without a link: type the round token. Any case works, and so does the whole
 * pasted link. Checked on the server before anything else is asked.
 */
export function RoundTokenEntry({ onOpened, initialError }: { onOpened: (round: OpenedRound) => void; initialError?: string }) {
    const id = useId();
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { token: "" } });

    const onSubmit = async (values: Values) => {
        let res: Awaited<ReturnType<typeof openRoundAction>>;
        try {
            res = await openRoundAction(values.token);
        } catch {
            setError("token", { message: "Couldn't reach the server. Check your connection and try again." });
            return;
        }
        if (!res.valid) {
            setError("token", { message: res.reason });
            return;
        }
        onOpened(res);
    };

    const message = errors.token?.message ?? initialError;

    return (
        <div className="mx-auto w-full max-w-md space-y-6 py-6">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-rcf-navy">
                    <BookOpen className="h-7 w-7" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-bold text-rcf-navy">Submit your results</h1>
                <p className="mt-2 text-sm text-slate-500">
                    Enter the round token the Academic Unit shared for this semester.
                </p>
            </div>

            <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
            >
                <div className="space-y-1">
                    <label htmlFor={`${id}-token`} className="text-xs font-medium text-gray-700">
                        Round token
                    </label>
                    <FormInput
                        id={`${id}-token`}
                        autoComplete="off"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="ACD-XXXXX"
                        aria-invalid={!!message}
                        aria-describedby={message ? `${id}-token-error` : `${id}-token-hint`}
                        className="font-mono uppercase tracking-widest"
                        {...register("token")}
                    />
                    {message ? (
                        <p id={`${id}-token-error`} role="alert" className="text-xs text-red-600">
                            {message}
                        </p>
                    ) : (
                        <p id={`${id}-token-hint`} className="text-xs text-slate-400">
                            Capitals or not, either works. You can paste the whole link too.
                        </p>
                    )}
                </div>

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
