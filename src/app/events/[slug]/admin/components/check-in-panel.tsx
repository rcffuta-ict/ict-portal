"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Camera, CameraOff, CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { checkInAttendeeAction } from "../actions";
import { levelLabel } from "@/lib/event-utils";

// The camera library only loads when someone opens the scanner — not for every admin
// who opens this page on mobile data to look at the numbers.
const Scanner = dynamic(
    () => import("@yudiel/react-qr-scanner").then((m) => m.Scanner),
    {
        ssr: false,
        loading: () => (
            <p role="status" className="flex h-64 items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Starting camera…
            </p>
        ),
    },
);

export interface CheckInRegistrant {
    id: string;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone_number?: string | null;
    level?: string | null;
    checked_in_at?: string | null;
}

type Result = { ok: boolean; title: string; detail: string };

function buzz(pattern: number | number[]) {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
}

const timeFmt = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

/**
 * Door check-in: scan the ticket QR a registrant got on their confirmation, or find
 * them by name, phone or email when they don't have it.
 *
 * Every check-in goes through checkInAttendeeAction, which refuses a ticket from another
 * event and a second scan of the same ticket. `onCheckedIn` lets the page update its
 * counts without reloading the whole registrant list over a slow connection.
 */
export function CheckInPanel({
    eventId,
    registrants,
    onCheckedIn,
}: {
    eventId: string;
    registrants: CheckInRegistrant[];
    onCheckedIn: (registrationId: string, checkedInAt: string) => void;
}) {
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    // A ref, not state: the scanner fires several times a second while a code is in
    // view, and a state update would arrive too late to stop the repeats.
    const locked = useRef(false);

    const checkIn = async (registrationId: string) => {
        setBusyId(registrationId);
        const res = await checkInAttendeeAction(eventId, registrationId).catch(() => null);
        setBusyId(null);
        if (!res) {
            buzz(400);
            setResult({ ok: false, title: "Couldn't reach the server", detail: "Check the connection and try again." });
            return;
        }
        if (res.success) {
            buzz([100, 50, 100]);
            onCheckedIn(res.registrationId, res.checkedInAt);
            setResult({
                ok: true,
                title: "Welcome in",
                detail: [res.fullName, res.level ? levelLabel(res.level) : null].filter(Boolean).join(" · "),
            });
        } else {
            buzz(400);
            setResult({ ok: false, title: "Not checked in", detail: res.error });
        }
    };

    const onScan = async (codes: { rawValue?: string }[]) => {
        const text = codes?.[0]?.rawValue;
        if (!text || locked.current) return;
        locked.current = true;
        buzz(50);
        await checkIn(text);
        // Hold the result on screen before the next scan can replace it.
        setTimeout(() => {
            locked.current = false;
        }, 1500);
    };

    const matches = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (term.length < 2) return [];
        return registrants
            .filter((r) =>
                `${r.first_name} ${r.last_name}`.toLowerCase().includes(term)
                || (r.email ?? "").toLowerCase().includes(term)
                || (r.phone_number ?? "").replace(/\s/g, "").includes(term.replace(/\s/g, "")),
            )
            .slice(0, 20);
    }, [registrants, query]);

    const checkedIn = registrants.filter((r) => r.checked_in_at).length;

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-600">
                <strong className="text-slate-900">{checkedIn}</strong> of {registrants.length} checked in.
            </p>

            {result && (
                <div
                    role="status"
                    aria-live="assertive"
                    className={`flex items-start gap-3 rounded-2xl border p-4 ${
                        result.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                    }`}
                >
                    {result.ok ? (
                        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
                    ) : (
                        <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                        <p className={`font-bold ${result.ok ? "text-emerald-900" : "text-red-900"}`}>{result.title}</p>
                        <p className={`text-sm ${result.ok ? "text-emerald-800" : "text-red-800"}`}>{result.detail}</p>
                    </div>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                {/* --- Scan a ticket --- */}
                <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="font-bold text-slate-900">Scan a ticket</h2>
                        <button
                            type="button"
                            onClick={() => {
                                setScanning((s) => !s);
                                setResult(null);
                            }}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-rcf-navy px-3 text-sm font-semibold text-white hover:bg-rcf-navy-light focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy focus-visible:ring-offset-2"
                        >
                            {scanning ? <CameraOff className="h-4 w-4" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
                            {scanning ? "Stop" : "Start camera"}
                        </button>
                    </div>
                    {scanning ? (
                        <div className="mt-4 overflow-hidden rounded-2xl bg-black">
                            <Scanner
                                onScan={onScan}
                                scanDelay={500}
                                constraints={{ facingMode: "environment" }}
                                components={{ finder: true }}
                                onError={() =>
                                    setResult({
                                        ok: false,
                                        title: "Camera unavailable",
                                        detail: "Allow camera access for this site, or find the person by name below.",
                                    })}
                            />
                        </div>
                    ) : (
                        <p className="mt-3 text-sm text-slate-500">
                            Each registrant got a QR ticket on their confirmation screen. Point the
                            camera at it; a ticket works once, and only for this event.
                        </p>
                    )}
                </section>

                {/* --- Find someone without a ticket --- */}
                <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                    <label htmlFor="checkin-search" className="font-bold text-slate-900">
                        No ticket? Find them
                    </label>
                    <div className="relative mt-3">
                        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                        <input
                            id="checkin-search"
                            type="search"
                            inputMode="search"
                            autoComplete="off"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Name, phone or email"
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-rcf-navy"
                        />
                    </div>
                    {query.trim().length >= 2 && matches.length === 0 && (
                        <p className="mt-3 text-sm text-slate-500">Nobody registered matches that.</p>
                    )}
                    <ul className="mt-3 divide-y divide-slate-100">
                        {matches.map((r) => (
                            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                        {r.first_name} {r.last_name}
                                    </p>
                                    <p className="truncate text-xs text-slate-500">
                                        {[r.phone_number, r.level ? levelLabel(r.level) : null].filter(Boolean).join(" · ")}
                                    </p>
                                </div>
                                {r.checked_in_at ? (
                                    <span className="shrink-0 text-xs font-semibold text-emerald-700">
                                        In at {timeFmt.format(new Date(r.checked_in_at))}
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => checkIn(r.id)}
                                        disabled={busyId === r.id}
                                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        {busyId === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                                        Check in
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
