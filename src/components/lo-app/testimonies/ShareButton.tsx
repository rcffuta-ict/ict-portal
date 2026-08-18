"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { recordTestimonyShare } from "@/app/lo-app/testimonies/actions";
import { testimonyExcerpt } from "@/lib/testimonies";

interface ShareButtonProps {
    testimonyId: string;
    title: string;
    body: string;
    shareCount: number;
    /** "inline" sits in a card's action row; "solid" is the primary button on the page. */
    variant?: "inline" | "solid";
}

/**
 * Sharing round is the point of the feature, so this uses the phone's own share
 * sheet (WhatsApp, wherever) when the browser supports it, and falls back to
 * copying the link — never a bare "copy this URL" instruction.
 */
export function ShareButton({
    testimonyId,
    title,
    body,
    shareCount,
    variant = "inline",
}: ShareButtonProps) {
    const [copied, setCopied] = useState(false);
    const [count, setCount] = useState(shareCount);

    const handleShare = async () => {
        const url =
            typeof window !== "undefined"
                ? `${window.location.origin}/lo-app/testimonies/${testimonyId}`
                : "";

        const shareData = {
            title: `Testimony: ${title}`,
            text: `${testimonyExcerpt(body, 140)}\n\nRead the full testimony:`,
            url,
        };

        let shared = false;
        try {
            if (typeof navigator !== "undefined" && navigator.share) {
                await navigator.share(shareData);
                shared = true;
            } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                await navigator.clipboard.writeText(`${shareData.text} ${url}`);
                shared = true;
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch {
            // A cancelled share sheet lands here too — nothing to report.
            return;
        }

        if (shared) {
            setCount((prev) => prev + 1);
            void recordTestimonyShare(testimonyId);
        }
    };

    const label = copied ? "Link copied" : "Share";

    if (variant === "solid") {
        return (
            <button
                type="button"
                onClick={handleShare}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rcf-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light sm:w-auto"
            >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {copied ? "Link copied" : "Share this testimony"}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={handleShare}
            aria-label={`Share "${title}"`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-rcf-navy"
        >
            {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
            ) : (
                <Link2 className="h-4 w-4" />
            )}
            <span>{label}</span>
            {count > 0 && <span className="text-slate-400 tabular-nums">{count}</span>}
        </button>
    );
}
