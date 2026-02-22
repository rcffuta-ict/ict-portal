"use client";

import React, { forwardRef } from "react";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: React.ReactNode;
    hideLabel?: boolean;
};

const FormSelect = forwardRef<HTMLSelectElement, Props>(
    ({ label, hideLabel = false, className = "", required = false, children, id, ...rest }, ref) => {
        const base =
            "w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition-all focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10";

        if (label && !hideLabel) {
            return (
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1" htmlFor={id}>
                        {label} {required ? <span className="text-pink-200">*</span> : null}
                    </label>
                    <div className="relative">
                        <select ref={ref} id={id} className={`${base} ${className}`} {...(rest as any)}>
                            {children}
                        </select>
                    </div>
                </div>
            );
        }

        return (
            <select ref={ref} id={id} className={`${base} ${className}`} {...(rest as any)}>
                {children}
            </select>
        );
    }
);

FormSelect.displayName = "FormSelect";

export default FormSelect;
