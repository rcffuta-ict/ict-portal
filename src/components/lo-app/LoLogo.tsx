"use client";

interface LoLogoProps {
    /** "sm" | "md" | "lg" */
    size?: "sm" | "md" | "lg";
    /** "dark" = for dark backgrounds (white text), "light" = for light backgrounds (navy text) */
    variant?: "dark" | "light";
    /** "short" = "Lo!", "full" = "Lo! App" */
    mode?: "short" | "full";
}

const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
};

const appTextSizes = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl",
};

export function LoLogo({
    size = "md",
    variant = "dark",
    mode = "short",
}: LoLogoProps) {
    const baseColor = variant === "dark" ? "text-white" : "text-rcf-navy";
    const appColor = variant === "dark" ? "text-white/70" : "text-rcf-navy/70";

    return (
        <span
            className={`${sizeClasses[size]} font-black tracking-tight select-none`}
        >
            <span className="text-rcf-gold">L</span>
            <span className={baseColor}>o</span>
            <span className="text-rcf-gold">!</span>
            {mode === "full" && (
                <span className={`${appTextSizes[size]} ${appColor} font-bold ml-1`}>
                    App
                </span>
            )}
        </span>
    );
}
