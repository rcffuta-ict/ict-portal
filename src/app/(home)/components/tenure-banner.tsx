"use client";

import { useState } from "react";
import Image from "next/image";
import { DEFAULT_TENURE_BANNER } from "@/config/tenure-branding";
import { imageLoaderFor } from "@/lib/cloudinary";

/**
 * The session's banner, shown whole at 3:1 — the same rules as the dashboard's
 * TenureHero: banners are lettered edge to edge, so nothing crops or covers them.
 *
 * A client component only for `onError`: a banner that fails to load (a dropped
 * connection, a deleted upload) falls back to the fellowship's default banner rather
 * than leaving an empty frame on the front page.
 */
export function TenureBanner({ src, alt }: { src: string | null; alt: string }) {
    const [broken, setBroken] = useState<string | null>(null);
    const own = src && src !== broken ? src : null;
    const banner = own || DEFAULT_TENURE_BANNER;

    return (
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-white/5 shadow-2xl ring-1 ring-white/15">
            <Image
                src={banner}
                alt={own ? alt : ""}
                fill
                // Below the fold on a phone, so it is left to load lazily (the default).
                sizes="(max-width: 1280px) 100vw, 1216px"
                loader={imageLoaderFor(banner)}
                unoptimized={banner.endsWith(".svg")}
                onError={() => own && setBroken(own)}
                className="object-cover"
            />
        </div>
    );
}
