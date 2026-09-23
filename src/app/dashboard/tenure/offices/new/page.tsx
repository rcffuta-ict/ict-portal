/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Loader2,
    ShieldAlert,
    CheckCircle2,
    Layers,
    Users,
    Lock,
} from "lucide-react";
import { getUnitsWithoutExcoAction, createPositionAction } from "../../actions";
import { AlertModal, useAlertModal } from "@/components/ui/alert-modal";
import { CompactPreloader } from "@/components/ui/preloader";

/**
 * Create an Executive office for a unit that has none.
 *
 * WHY THIS IS A PAGE AND NOT A PANEL IN THE CABINET TAB
 *
 * Minting an office adds a node to the administrative hierarchy and a row of privilege
 * tags that decide what its holder may do. That is a different kind of act from adding
 * somebody to a roster, and it was previously a third toggle sitting beside "Roster"
 * and "Appoint" — one misclick away from the screen you use every week. A separate
 * route makes it a place you go to on purpose.
 *
 * WHY IT ONLY CREATES EXCO OFFICES
 *
 * The fellowship's spine — President, the two VPs, the ICT Coordinator, the Level
 * Coordinators — is fixed in src/config/leadership-positions.ts, seeded from there and
 * held in place by the `enforce_frozen_position_catalogue` trigger. Those offices are
 * constant across tenures; only their occupants change, and inventing a thirty-seventh
 * one at runtime is how an access-control model stops being describable.
 *
 * Exactly one case genuinely needs runtime creation: a unit created after the catalogue
 * was seeded has no Executive, and nothing else can give it one. So this page starts
 * from the UNIT rather than from a blank form, and everything else — title, alias,
 * slug, privileges — is derived from it. There is nothing here to mistype, and no way
 * to end up with an office whose scope does not match its unit.
 */
export default function NewOfficePage() {
    const router = useRouter();
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const [units, setUnits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(true);
    const [selected, setSelected] = useState<any>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const res = await getUnitsWithoutExcoAction();
            if (cancelled) return;
            if (!res.success) setAuthorized(false);
            else setUnits(res.data);
            setLoading(false);
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const derived = selected
        ? {
            title: `Executive — ${selected.name}`,
            alias: `${selected.name.replace(/\s+(Unit|Team)$/i, "")} Exco`,
            slug: `exco-${selected.slug}`,
            privilege: `EXCO:${selected.slug}`,
            description: `Leads ${selected.name}. Adds and removes its members directly.`,
        }
        : null;

    const handleCreate = async () => {
        if (!derived) return;
        setCreating(true);
        const formData = new FormData();
        formData.append("title", derived.title);
        formData.append("alias", derived.alias);
        formData.append("slug", derived.slug);
        formData.append("description", derived.description);
        formData.append(
            "privileges",
            JSON.stringify([{ tag: "EXCO", scope: selected.slug }]),
        );

        const res = await createPositionAction(formData);
        setCreating(false);

        if (res.success) {
            showAlert({
                type: "success",
                message: `${derived.title} created. You can now appoint someone to it from the Cabinet.`,
                onConfirm: () => router.push("/dashboard/tenure"),
            });
            setUnits((prev) => prev.filter((u) => u.id !== selected.id));
            setSelected(null);
        } else {
            showAlert({ type: "error", message: res.error });
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-96 items-center justify-center">
                <CompactPreloader
                    title="Loading offices"
                    subtitle="Checking which units need an Executive…"
                />
            </div>
        );
    }

    if (!authorized) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
                <ShieldAlert className="mb-4 h-16 w-16 text-red-500" />
                <h1 className="text-2xl font-bold text-slate-900">Access denied</h1>
                <p className="mt-2 max-w-md text-slate-500">
                    Only the VP Administration and the ICT Coordinator may change the office
                    catalogue.
                </p>
                <Link
                    href="/dashboard/tenure"
                    className="mt-6 text-sm font-bold text-rcf-navy hover:underline"
                >
                    Back to the Tenure Manager
                </Link>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-8 pb-20">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            <div className="space-y-2 border-b border-slate-200 pb-6">
                <Link
                    href="/dashboard/tenure"
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rcf-navy"
                >
                    <ArrowLeft className="h-4 w-4" /> Tenure Manager
                </Link>
                <h1 className="text-3xl font-bold text-rcf-navy">New Executive office</h1>
                <p className="max-w-2xl text-slate-500">
                    Gives a unit or team its Executive. Every other office in the fellowship is
                    fixed in the catalogue and cannot be created here.
                </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p className="text-xs leading-relaxed text-slate-600">
                    <span className="font-bold">The catalogue is frozen on purpose.</span>{" "}
                    President, the Vice Presidents, the ICT Coordinator and the Level
                    Coordinators are constant across tenures — only who holds them changes. The
                    one office that can legitimately be missing is a new unit&rsquo;s Executive,
                    which is what this page creates.
                </p>
            </div>

            {units.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
                    <h2 className="text-lg font-bold text-slate-900">
                        Every unit already has its Executive
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                        There is nothing to create. New offices appear here automatically when a
                        unit or team is added on the Structure tab.
                    </p>
                    <Link
                        href="/dashboard/tenure"
                        className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-rcf-navy px-5 text-sm font-bold text-white hover:opacity-90"
                    >
                        Back to the Cabinet
                    </Link>
                </div>
            ) : (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Which unit needs an Executive?
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {units.length}{" "}
                            {units.length === 1 ? "unit has" : "units have"} no active
                            Executive office.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {units.map((unit) => {
                            const isSelected = selected?.id === unit.id;
                            const Icon = unit.type === "TEAM" ? Users : Layers;
                            return (
                                <button
                                    key={unit.id}
                                    type="button"
                                    onClick={() => setSelected(isSelected ? null : unit)}
                                    className={`flex min-h-[44px] items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rcf-navy ${
                                        isSelected
                                            ? "border-rcf-navy bg-rcf-navy/5"
                                            : "border-slate-200 bg-white hover:border-rcf-navy/40 hover:bg-slate-50"
                                    }`}
                                >
                                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-bold text-slate-900">
                                            {unit.name}
                                        </span>
                                        <span className="block truncate font-mono text-[10px] text-slate-400">
                                            {unit.slug}
                                        </span>
                                        {unit.description && (
                                            <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                                                {unit.description}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {derived && (
                        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-900">
                                This is what will be created
                            </h3>

                            {/* Read-only, deliberately. Every field is derived from the unit,
                                so there is nothing to get wrong -- and a free-text privilege
                                builder here is exactly how an office ends up scoped to a unit
                                it does not lead. */}
                            <dl className="space-y-3 text-sm">
                                <Row label="Office" value={derived.title} />
                                <Row label="Called" value={derived.alias} />
                                <Row
                                    label="Slug"
                                    value={derived.slug}
                                    mono
                                    hint="Immutable once created — it IS the access-control scope."
                                />
                                <Row
                                    label="Privilege"
                                    value={derived.privilege}
                                    mono
                                    hint={`Manages ${selected.name} and nothing else.`}
                                />
                            </dl>

                            <button
                                type="button"
                                disabled={creating}
                                onClick={handleCreate}
                                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-rcf-navy px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                                {creating && (
                                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                                )}
                                {creating ? "Creating…" : `Create ${derived.alias}`}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Row({
    label,
    value,
    mono,
    hint,
}: {
    label: string;
    value: string;
    mono?: boolean;
    hint?: string;
}) {
    return (
        <div className="flex flex-col gap-0.5 border-b border-slate-100 pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-4">
            <dt className="w-32 shrink-0 text-xs font-bold uppercase tracking-wide text-slate-400">
                {label}
            </dt>
            <dd className="min-w-0">
                <span
                    className={`block break-words font-medium text-slate-900 ${
                        mono ? "font-mono text-xs" : "text-sm"
                    }`}
                >
                    {value}
                </span>
                {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
            </dd>
        </div>
    );
}
