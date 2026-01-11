"use client";

import clsx from "clsx";
import { Code2 } from "lucide-react"; // Ensure you have lucide-react installed

interface CopyrightProps {
    className?: string;
    tenure?: string | null;
    variant?: "light" | "dark";
    /** Force a specific layout direction (optional) */
    layout?: "row" | "column";
}

export function Copyright({
    className,
    tenure,
    variant = "light",
    layout,
}: CopyrightProps) {
    const currentYear = new Date().getFullYear();

    // Color Configurations
    const theme = {
        light: {
            text: "text-blue-100/60",
            strong: "text-white",
            icon: "text-yellow-400",
            separator: "bg-white/20",
        },
        dark: {
            text: "text-slate-500",
            strong: "text-slate-900",
            icon: "text-rcf-navy", // Or slate-700 if rcf-navy isn't global
            separator: "bg-slate-300",
        },
    }[variant];

    return (
        <div
            className={clsx(
                "text-[11px] md:text-xs font-medium tracking-wide transition-colors",
                theme.text,
                className
            )}
        >
            <div
                className={clsx(
                    "flex",
                    // If layout prop is set, force it. Otherwise adapt to screen size.
                    layout === "column"
                        ? "flex-col gap-2"
                        : "flex-col md:flex-row md:items-center gap-y-2 gap-x-4 flex-wrap"
                )}
            >
                {/* 1. Legal Entity */}
                <p className="whitespace-nowrap">
                    &copy; {currentYear} RCF FUTA Chapter.
                </p>

                {/* Separator (Hidden on mobile stack, visible on desktop row) */}
                <span
                    className={clsx(
                        "hidden h-1 w-1 rounded-full",
                        theme.separator,
                        layout === "column" ? "hidden" : "md:block"
                    )}
                />

                {/* 2. Credits & Context */}
                <div className="flex items-center gap-4">
                    {/* Powered By */}
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span>Powered by</span>
                        <span
                            className={clsx(
                                "font-bold flex items-center gap-1",
                                theme.strong
                            )}
                        >
                            <Code2 className={clsx("h-3 w-3", theme.icon)} />
                            ICT Team
                        </span>
                    </div>

                    {/* Tenure Display */}
                    {tenure && (
                        <>
                            <span
                                className={clsx(
                                    "h-1 w-1 rounded-full",
                                    theme.separator
                                )}
                            />
                            <span className="opacity-90 whitespace-nowrap">
                                {tenure}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
