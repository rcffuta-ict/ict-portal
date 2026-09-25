"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, PartyPopper } from "lucide-react";
import { RESULTS_PATH, parseRoundTokenInput, resultsPath } from "@/lib/level-token";
import { openRoundAction, type RoundIdentity } from "./action";
import { RoundTokenEntry, type OpenedRound } from "./components/round-token-entry";
import { IdentifyForm, type Identified } from "./components/identify-form";
import { ResultsForm, type SubmitDone } from "./components/results-form";

/**
 * /academics: submit a semester's results with the Academic Unit's round token.
 *
 * Token → who you are → your results → done. The token lives in the URL
 * (`?round=ACD-7KX2P`) so the shared link and a refresh land on the same round. The
 * identity lives only in this page's memory: every server call re-checks it.
 */
export default function ResultsPage() {
    return (
        <Suspense fallback={<CenteredLoader />}>
            <ResultsInner />
        </Suspense>
    );
}

function CenteredLoader() {
    return (
        <div className="flex justify-center py-20" role="status" aria-label="Loading">
            <Loader2 className="h-6 w-6 animate-spin text-rcf-navy motion-reduce:animate-none" />
        </div>
    );
}

type RoundState =
    | { status: "loading" }
    | { status: "invalid"; reason: string }
    | { status: "open"; round: OpenedRound };

function ResultsInner() {
    const params = useSearchParams();
    const router = useRouter();
    const raw = params.get("round")?.trim() || "";
    const key = raw ? (parseRoundTokenInput(raw) ?? raw) : "";

    // The last check, keyed by the token it was for, so a token typed on this page (and
    // already checked) isn't sent to the server a second time.
    const [checked, setChecked] = useState<{ key: string; state: RoundState } | null>(null);
    const [who, setWho] = useState<{ key: string; identity: RoundIdentity; result: Identified } | null>(null);
    const [done, setDone] = useState<SubmitDone | null>(null);
    const round: RoundState = checked && checked.key === key ? checked.state : { status: "loading" };

    useEffect(() => {
        if (!key || checked?.key === key) return;
        let active = true;
        (async () => {
            let state: RoundState;
            try {
                const res = await openRoundAction(key);
                state = res.valid ? { status: "open", round: res } : { status: "invalid", reason: res.reason };
            } catch {
                state = { status: "invalid", reason: "Couldn't reach the server. Check your connection and try again." };
            }
            if (active) setChecked({ key, state });
        })();
        return () => {
            active = false;
        };
    }, [key, checked?.key]);

    if (done) {
        return (
            <div className="mx-auto max-w-md space-y-4 py-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
                    <PartyPopper className="h-8 w-8" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-bold text-rcf-navy">Thank you, {done.firstName}</h1>
                <p className="text-sm text-slate-500">
                    {done.saved === 1 ? "Your results are" : `${done.saved} semesters are`} saved for the {done.roundLabel} round.
                    You can close this page.
                </p>
            </div>
        );
    }

    if (!key) {
        return (
            <RoundTokenEntry
                onOpened={(opened) => {
                    setChecked({ key: opened.token, state: { status: "open", round: opened } });
                    router.replace(resultsPath(opened.token));
                }}
            />
        );
    }

    if (round.status === "loading") return <CenteredLoader />;

    if (round.status === "invalid") {
        return (
            <RoundTokenEntry
                initialError={round.reason}
                onOpened={(opened) => {
                    setChecked({ key: opened.token, state: { status: "open", round: opened } });
                    router.replace(resultsPath(opened.token));
                }}
            />
        );
    }

    const identified = who && who.key === key ? who : null;
    if (!identified) {
        return (
            <div>
                <IdentifyForm
                    token={round.round.token}
                    roundLabel={round.round.label}
                    onIdentified={(identity, result) => setWho({ key, identity, result })}
                />
                <p className="text-center text-xs text-slate-400">
                    Wrong round?{" "}
                    <button
                        type="button"
                        onClick={() => router.replace(RESULTS_PATH)}
                        className="font-bold text-rcf-navy underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                    >
                        Enter another token
                    </button>
                </p>
            </div>
        );
    }

    return (
        <ResultsForm
            token={round.round.token}
            identity={identified.identity}
            firstName={identified.result.firstName}
            roundLabel={identified.result.roundLabel}
            department={identified.result.department}
            slots={identified.result.slots}
            onDone={setDone}
        />
    );
}
