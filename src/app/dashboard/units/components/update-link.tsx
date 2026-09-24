"use client";

import { useEffect, useState } from "react";
import { Link2, Copy, Check, KeyRound, Loader2 } from "lucide-react";
import { copyMemberUpdateLinkAction, getMemberUpdateLinkStatusAction } from "../actions";

type Status =
    | { state: "loading" }
    | { state: "error"; message: string }
    | { state: "ready"; available: boolean; generation: string | null; reason: "no-token" | "no-generation" | null };

/**
 * Share a member's update link — the one their LEVEL COORDINATOR issued.
 *
 * An exco can copy it but never create it: the token is a credential scoped to a
 * generation, and it belongs to whoever coordinates that generation. When there isn't
 * one, this says so and names the generation, rather than showing a button that fails.
 *
 * The token is fetched only when "Copy" is pressed, and each copy is logged.
 */
export function UpdateLink({
    unitId,
    profileId,
    memberName,
}: {
    unitId: string;
    profileId: string;
    memberName: string;
}) {
    const [status, setStatus] = useState<Status>({ state: "loading" });
    const [copying, setCopying] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getMemberUpdateLinkStatusAction(unitId, profileId).then((res) => {
            if (cancelled) return;
            setStatus(
                res.success
                    ? { state: "ready", available: res.available, generation: res.generation, reason: res.reason }
                    : { state: "error", message: res.error },
            );
        });
        return () => {
            cancelled = true;
        };
    }, [unitId, profileId]);

    const copy = async () => {
        setCopying(true);
        setCopyError(null);
        const res = await copyMemberUpdateLinkAction(unitId, profileId);
        if (!res.success) {
            setCopyError(res.error);
            setCopying(false);
            return;
        }
        const url = `${window.location.origin}${res.path}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard can be refused (older Android WebViews, insecure origins). Show
            // the link so it can still be copied by hand.
            setCopyError(`Couldn't copy automatically. The link is: ${url}`);
        }
        setCopying(false);
    };

    if (status.state === "loading") {
        return (
            <p role="status" className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Checking for an update link…
            </p>
        );
    }

    if (status.state === "error") {
        return (
            <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                {status.message}
            </p>
        );
    }

    if (!status.available) {
        return (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="flex items-center gap-2 font-bold text-amber-800">
                    <KeyRound className="h-4 w-4" aria-hidden="true" /> No update link
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                    {status.reason === "no-generation"
                        ? `${memberName} isn't in a generation yet, so there's no coordinator to issue one.`
                        : `No update link for ${status.generation ?? "their generation"} — their coordinator has not issued one.`}
                </p>
            </section>
        );
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-bold text-slate-700">
                <Link2 className="h-4 w-4" aria-hidden="true" /> Update link
            </h2>
            <p className="mt-1 text-sm text-slate-500">
                Send this to {memberName} to update their details. It&apos;s{" "}
                {status.generation ? `the ${status.generation} coordinator's` : "their coordinator's"} link, and
                each copy is recorded.
            </p>
            <button
                type="button"
                onClick={copy}
                disabled={copying}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-rcf-navy px-5 text-sm font-bold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy focus-visible:ring-offset-2 disabled:opacity-60 sm:w-auto"
            >
                {copying ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : copied ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? "Copied" : copying ? "Copying…" : "Copy update link"}
            </button>
            {copyError && (
                <p role="alert" className="mt-2 break-all text-xs text-red-600">
                    {copyError}
                </p>
            )}
        </section>
    );
}
