"use client";

import { useState } from "react";
import { cloudinaryLoader } from "@/lib/cloudinary";

/**
 * A member's photo in a Workforce card, or their initials.
 *
 * A Cloudinary photo is requested at twice its displayed size (for sharp screens) rather
 * than as uploaded: a page of 24 cards is 24 photos, and an uploaded phone picture is
 * often several megabytes. A photo that fails to load falls back to the initials rather
 * than a broken-image icon.
 */
export function MemberAvatar({
    url,
    first,
    last,
    size = 40,
    ring = false,
}: {
    url?: string | null;
    first?: string | null;
    last?: string | null;
    /** Displayed size in px. */
    size?: number;
    /** A gold ring, for a birthday today. */
    ring?: boolean;
}) {
    const [broken, setBroken] = useState<string | null>(null);
    const initials = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
    const src = url && url !== broken
        ? url.includes("res.cloudinary.com")
            ? cloudinaryLoader({ src: url, width: size * 2 })
            : url
        : null;

    return (
        <div
            style={{ width: size, height: size }}
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-blue-600 ${
                ring ? "ring-2 ring-rcf-gold ring-offset-2" : ""
            }`}
        >
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={size}
                    height={size}
                    onError={() => setBroken(url ?? null)}
                    className="h-full w-full object-cover"
                />
            ) : (
                <span aria-hidden="true">{initials}</span>
            )}
        </div>
    );
}
