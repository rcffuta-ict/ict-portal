"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Check, Loader2, Lock } from "lucide-react";
import { format } from "date-fns";
import type { AcademicSettings } from "@/lib/academics-db";
import { updateAcademicSettingsAction } from "../actions";

type Values = Omit<AcademicSettings, "updatedAt">;

const SWITCHES: { key: keyof Values; title: string; text: string }[] = [
    {
        key: "unitHeadsSeeIndividuals",
        title: "Unit and team heads see their members' results",
        text: "Workforce → Academics shows the unit's heads each member's GPA and CGPA, and lets them download the unit's full academic record for reports to the authorities. Off: totals only.",
    },
    {
        key: "levelCoordsSeeIndividuals",
        title: "Level coordinators see their level's results",
        text: "Levels → Academics shows a generation's coordinator each member's results. Off: totals only.",
    },
    {
        key: "membersSeeOwn",
        title: "Members see their own history",
        text: "Signed-in members get a “My results” card on My Identity.",
    },
];

/**
 * Who sees individual results OUTSIDE this module. Decided by whoever can write to
 * Academics (the Academic Unit), and enforced on the server by every action that reads
 * results, not just by hiding things here.
 */
export function SettingsPanel({ settings, canWrite }: { settings: AcademicSettings; canWrite: boolean }) {
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const {
        register,
        handleSubmit,
        reset,
        formState: { isSubmitting, isDirty },
    } = useForm<Values>({
        defaultValues: {
            unitHeadsSeeIndividuals: settings.unitHeadsSeeIndividuals,
            levelCoordsSeeIndividuals: settings.levelCoordsSeeIndividuals,
            membersSeeOwn: settings.membersSeeOwn,
        },
    });

    const onSubmit = async (v: Values) => {
        setServerError(null);
        setSaved(false);
        try {
            const res = await updateAcademicSettingsAction(v);
            if (!res.success) return setServerError(res.error);
            reset(v);
            setSaved(true);
            router.refresh();
        } catch {
            setServerError("Couldn't reach the server. Nothing was changed; try again.");
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div>
                <h4 className="font-bold text-slate-700">Who sees individual results</h4>
                <p className="mt-1 text-xs text-slate-500">
                    Everyone with access to this module sees them. These decide who else does. Totals are always shown.
                </p>
            </div>

            <ul className="space-y-2">
                {SWITCHES.map((s) => (
                    <li key={s.key}>
                        <label className={`flex items-start gap-3 rounded-xl border border-slate-200 p-3 ${canWrite ? "cursor-pointer hover:border-rcf-navy/40" : ""}`}>
                            <input
                                type="checkbox"
                                disabled={!canWrite}
                                className="mt-0.5 h-5 w-5 shrink-0 accent-rcf-navy"
                                {...register(s.key)}
                            />
                            <span>
                                <span className="block text-sm font-bold text-slate-800">{s.title}</span>
                                <span className="block text-xs text-slate-500">{s.text}</span>
                            </span>
                        </label>
                    </li>
                ))}
            </ul>

            {settings.updatedAt && (
                <p className="text-xs text-slate-400">Last changed {format(new Date(settings.updatedAt), "d MMM yyyy, HH:mm")}.</p>
            )}
            {serverError && <p role="alert" className="text-sm text-red-700">{serverError}</p>}

            {canWrite ? (
                <button
                    type="submit"
                    disabled={isSubmitting || !isDirty}
                    className="btn-primary flex h-11 items-center justify-center gap-2 px-6 disabled:opacity-60"
                >
                    {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : saved && !isDirty ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                    ) : null}
                    {isSubmitting ? "Saving…" : saved && !isDirty ? "Saved" : "Save"}
                </button>
            ) : (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Only those who can edit Academics can change these.
                </p>
            )}
        </form>
    );
}
