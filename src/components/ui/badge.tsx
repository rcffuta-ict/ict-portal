import React from "react";

export type BadgeVariant =
    | "default"
    | "secondary"
    | "success"
    | "warning"
    | "info"
    | "error"
    | "purple"
    | "pink"
    | "orange"
    | "gray"
    | "outline";

export type BadgeSize = "sm" | "default" | "lg";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    size?: BadgeSize;
    text?: string;
    icon?: React.ReactNode | string;
    children?: React.ReactNode;
}

const getVariantClasses = (variant: BadgeVariant): string => {
    const variants = {
        default: "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200",
        secondary: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200",
        success: "bg-green-100 text-green-800 border-green-200 hover:bg-green-200",
        warning: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200",
        info: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200",
        error: "bg-red-100 text-red-800 border-red-200 hover:bg-red-200",
        purple: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200",
        pink: "bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-200",
        orange: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200",
        gray: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200",
        outline: "bg-transparent text-slate-700 border-slate-300 hover:bg-slate-50",
    };
    return variants[variant] || variants.default;
};

const getSizeClasses = (size: BadgeSize): string => {
    const sizes = {
        sm: "px-2 py-0.5 text-xs",
        default: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
    };
    return sizes[size] || sizes.default;
};

export function Badge({
    variant = "default",
    size = "default",
    text,
    icon,
    children,
    className = "",
    ...props
}: BadgeProps) {
    const content = children || text;

    const baseClasses = "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors";
    const variantClasses = getVariantClasses(variant);
    const sizeClasses = getSizeClasses(size);

    const combinedClasses = `${baseClasses} ${variantClasses} ${sizeClasses} ${className}`.trim();

    return (
        <span className={combinedClasses} {...props}>
            {icon && (
                <span className="shrink-0 flex items-center">
                    {typeof icon === 'string' ? <span>{icon}</span> : icon}
                </span>
            )}
            {content && <span>{content}</span>}
        </span>
    );
}
