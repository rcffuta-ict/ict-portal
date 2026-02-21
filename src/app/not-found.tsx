"use client";

import Link from "next/link";

export default function NotFoundPage() {
    return (
        <div className="nf-page">
            <div className="nf-page__glow nf-page__glow--purple" />
            <div className="nf-page__glow nf-page__glow--blue" />

            <div className="nf-page__content">
                <div className="nf-digits">
                    <span className="nf-digit" style={{ animationDelay: "0s" }}>
                        4
                    </span>
                    <span
                        className="nf-digit nf-digit--zero"
                        style={{ animationDelay: "0.12s" }}
                    >
                        0
                    </span>
                    <span
                        className="nf-digit"
                        style={{ animationDelay: "0.24s" }}
                    >
                        4
                    </span>
                </div>
                <p className="nf-page__title">Page Not Found</p>
                <p className="nf-page__sub">
                    Looks like this page took the wrong turn at the Oracle…
                </p>
                <Link href="/" className="nf-btn">
                    ← Back to Home
                </Link>
            </div>
        </div>
    );
}
