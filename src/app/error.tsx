"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="error-page">
            <div className="error-page__glow error-page__glow--red" />
            <div className="error-page__glow error-page__glow--purple" />

            <div className="error-page__content">
                <div className="error-page__bolt">⚡</div>
                <p className="error-page__eyebrow">Oops</p>
                <h1 className="error-page__heading glitch" data-text="ERROR">
                    ERROR
                </h1>
                <p className="error-page__sub">
                    Something went sideways on our end.
                </p>
                {error?.message && (
                    <p className="error-page__detail">{error.message}</p>
                )}
                <div className="error-page__actions">
                    <button className="ep-btn ep-btn--primary" onClick={reset}>
                        ↺ Try Again
                    </button>
                    <Link href="/" className="ep-btn ep-btn--secondary">
                        ← Go Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
