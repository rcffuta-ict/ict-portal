"use client";

import React, { forwardRef } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
    label?: React.ReactNode;
    hideLabel?: boolean;
    isMatric?: boolean; // New prop to enable matric formatting
};

const FormInput = forwardRef<HTMLInputElement, Props>(
    (
        {
            label,
            hideLabel = false,
            className = "",
            required = false,
            isMatric = false,
            onChange,
            ...rest
        },
        ref
    ) => {
        const base =
            "w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition-all focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 placeholder:text-slate-400";

        // Intercept the change event to format the text
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (isMatric) {
                // 1. Get raw alphanumeric values only (Strip symbols/spaces) and Uppercase
                const raw = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "");

                // 2. Rebuild with strict FUTA format (AAA/YY/####)
                let formatted = raw;

                // Add first slash after Dept code (3 chars) e.g., "MEE/"
                if (raw.length > 3) {
                    formatted = `${raw.slice(0, 3)}/${raw.slice(3)}`;
                }

                // Add second slash after Year (3 + 2 = 5 chars) e.g., "MEE/19/"
                if (raw.length > 5) {
                    formatted = `${raw.slice(0, 3)}/${raw.slice(
                        3,
                        5
                    )}/${raw.slice(5)}`;
                }

                // 3. Update the event value
                e.target.value = formatted;
            }

            // Call the original onChange
            if (onChange) {
                onChange(e);
            }
        };

        const inputElement = (
            <input
                ref={ref}
                required={required}
                onChange={handleChange}
                className={`${base} ${className}`}
                {...rest}
            />
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
                    {inputElement}
                </div>
            );
        }

        return inputElement;
    }
);

FormInput.displayName = "FormInput";

export default FormInput;
