"use client";

import Link from "next/link";
import { GraduationCap, Mail, Phone } from "lucide-react";
import { MemberAvatar } from "./member-avatar";

/**
 * One member on a roster — Levels and Workforce draw the same card.
 *
 * The name links to the member's page; email and phone are their own links (mail, call),
 * so the whole card can't be one big link. `badge` is for a status worth seeing at a
 * glance (an Exco), `meta` for a quiet line (level, department), `action` for a control
 * that belongs to the card (remove from the unit).
 */
export function RosterCard({
    href,
    firstName,
    lastName,
    gender,
    avatarUrl,
    email,
    phone,
    meta,
    badge,
    action,
}: {
    href: string;
    firstName?: string | null;
    lastName?: string | null;
    gender?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
    phone?: string | null;
    meta?: string | null;
    badge?: React.ReactNode;
    action?: React.ReactNode;
}) {
    const name = [firstName, lastName].filter(Boolean).join(" ") || "Unnamed member";
    return (
        <div className="flex h-full min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 transition-colors hover:border-rcf-navy/30 hover:bg-slate-50">
            <MemberAvatar url={avatarUrl} first={firstName} last={lastName} gender={gender} size={44} />
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                    <Link
                        href={href}
                        className="truncate text-sm font-bold text-slate-900 hover:text-rcf-navy hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                    >
                        {name}
                    </Link>
                    {badge}
                </div>
                {email && (
                    <a href={`mailto:${email}`} className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-slate-500 hover:text-rcf-navy">
                        <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{email}</span>
                    </a>
                )}
                {phone && (
                    <a href={`tel:${phone}`} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rcf-navy">
                        <Phone className="h-3 w-3 shrink-0" aria-hidden="true" /> {phone}
                    </a>
                )}
                {meta && (
                    <span className="flex min-w-0 items-center gap-1 text-[11px] text-slate-400">
                        <GraduationCap className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{meta}</span>
                    </span>
                )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
