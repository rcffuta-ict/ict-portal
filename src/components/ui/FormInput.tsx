"use client";

import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
    label?: React.ReactNode;
    hideLabel?: boolean;
};

export default function FormInput({
    label,
    hideLabel = false,
    className = "",
    required = false,
    ...rest
}: Props) {
    const base =
        "w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition-all focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 placeholder:text-slate-400";

    if (label && !hideLabel) {
        return (
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                    {label} {required ? <span className="text-pink-200">*</span> : null}
                </label>
                <input required={required} className={`${base} ${className}`} {...(rest as any)} />
            </div>
        );
    }

    return <input required={required} className={`${base} ${className}`} {...(rest as any)} />;
}
