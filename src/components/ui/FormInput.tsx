"use client";

import React, { forwardRef } from "react";
import clsx from "clsx";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
    label?: React.ReactNode;
    hideLabel?: boolean;
    isMatric?: boolean;
    leftIcon?: React.ReactNode; // <--- New Prop
    rightIcon?: React.ReactNode; // <--- New Prop
};

const FormInput = forwardRef<HTMLInputElement, Props>(
    (
        {
            label,
            hideLabel = false,
            className = "",
            required = false,
            isMatric = false,
            leftIcon,
            rightIcon,
            onChange,
            ...rest
        },
        ref
    ) => {
        // Base styles
        const baseStyles =
            "w-full h-12 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium outline-none transition-all focus:border-rcf-navy focus:bg-white focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400";

        // Dynamic padding based on icons
        const paddingClass = `
            ${leftIcon ? "pl-10" : "px-4"} 
            ${rightIcon ? "pr-10" : "pr-4"}
        `;

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (isMatric) {
                const raw = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "");
                let formatted = raw;
                if (raw.length > 3)
                    formatted = `${raw.slice(0, 3)}/${raw.slice(3)}`;
                if (raw.length > 5)
                    formatted = `${raw.slice(0, 3)}/${raw.slice(
                        3,
                        5
                    )}/${raw.slice(5)}`;
                e.target.value = formatted;
            }
            if (onChange) onChange(e);
        };

        const inputMarkup = (
            <div className="relative group">
                {/* Left Icon Position */}
                {leftIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-rcf-navy pointer-events-none">
                        {leftIcon}
                    </div>
                )}

                <input
                    ref={ref}
                    required={required}
                    onChange={handleChange}
                    className={clsx(baseStyles, paddingClass, className)} // Use cn() or template literal
                    {...rest}
                />
    
                {/* Right Icon Position */}
                {rightIcon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-rcf-navy">
                        {rightIcon}
                    </div>
                )}
            </div>
        );

        if (label && !hideLabel) {
            return (
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">
                        {label}{" "}
                        {required ? (
                            <span className="text-pink-500">*</span>
                        ) : null}
                    </label>
                    {inputMarkup}
                </div>
            );
        }

        return inputMarkup;
    }
);

FormInput.displayName = "FormInput";

export default FormInput;
