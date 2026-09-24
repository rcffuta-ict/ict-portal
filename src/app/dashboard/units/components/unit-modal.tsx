"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * The frame every unit dialog opens in.
 *
 * Full-screen on a phone, a centred card from `sm` up. The old dialogs were a fixed
 * 600px tall, which on a small Android phone put the close button and the add form
 * off-screen behind the browser chrome. Height follows the viewport here (`dvh`, so the
 * collapsing address bar is accounted for) and only the body scrolls.
 */
export function UnitModal({
    title,
    subtitle,
    onClose,
    children,
    wide = false,
}: {
    title: string;
    subtitle?: React.ReactNode;
    onClose: () => void;
    children: React.ReactNode;
    /** Admin dialogs carry tabs and a wider table. */
    wide?: boolean;
}) {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        // Stop the page behind scrolling along with the dialog on touch devices.
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = previous;
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-4"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="unit-modal-title"
                onClick={(e) => e.stopPropagation()}
                className={`flex h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[85dvh] sm:rounded-2xl ${
                    wide ? "sm:max-w-4xl" : "sm:max-w-3xl"
                }`}
            >
                <div className="safe-top shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 id="unit-modal-title" className="truncate font-bold text-slate-900">
                                {title}
                            </h3>
                            {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
                        </div>
                        <button
                            ref={closeRef}
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="-m-1 rounded-lg p-2 text-slate-500 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
                <div className="safe-bottom flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
            </div>
        </div>
    );
}
