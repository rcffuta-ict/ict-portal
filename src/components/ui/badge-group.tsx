import React from "react";
import { Badge, BadgeProps } from "./badge";

export interface BadgeGroupProps {
    children: React.ReactNode;
    className?: string;
    spacing?: "tight" | "normal" | "loose";
}

export function BadgeGroup({ children, className = "", spacing = "normal" }: BadgeGroupProps) {
    const spacingClasses = {
        tight: "space-x-1",
        normal: "space-x-2",
        loose: "space-x-3"
    };

    return (
        <div className={`flex items-center flex-wrap gap-1 ${spacingClasses[spacing]} ${className}`}>
            {children}
        </div>
    );
}

// Utility badge components
export function CountBadge({ count, label, ...props }: { count: number; label?: string } & Omit<BadgeProps, 'text'>) {
    return (
        <Badge
            variant="info"
            size="sm"
            text={label ? `${count} ${label}` : count.toString()}
            icon="🔢"
            {...props}
        />
    );
}

export function StatusBadge({
    status,
    variant = "default",
    ...props
}: {
    status: string;
    variant?: "online" | "offline" | "pending" | "success" | "error" | "default"
} & Omit<BadgeProps, 'text' | 'variant'>) {

    const statusVariants = {
        online: { variant: "success" as const, icon: "🟢" },
        offline: { variant: "gray" as const, icon: "⚫" },
        pending: { variant: "warning" as const, icon: "🟡" },
        success: { variant: "success" as const, icon: "✅" },
        error: { variant: "error" as const, icon: "❌" },
        default: { variant: "default" as const, icon: "📋" }
    };

    const config = statusVariants[variant];

    return (
        <Badge
            variant={config.variant}
            size="sm"
            text={status}
            icon={config.icon}
            {...props}
        />
    );
}

export function FilterBadge({ isActive, label, onClear, ...props }: {
    isActive: boolean;
    label: string;
    onClear?: () => void;
} & Omit<BadgeProps, 'text' | 'variant' | 'onClick'>) {

    if (!isActive) return null;

    return (
        <Badge
            variant="warning"
            size="sm"
            text={label}
            icon="🔍"
            className="cursor-pointer hover:bg-yellow-200"
            onClick={onClear}
            title="Click to clear filter"
            {...props}
        />
    );
}

export function MembershipBadge({
    isMember,
    memberLabel = "Member",
    guestLabel = "Guest",
    ...props
}: {
    isMember: boolean;
    memberLabel?: string;
    guestLabel?: string;
} & Omit<BadgeProps, 'text' | 'variant' | 'icon'>) {

    return (
        <Badge
            variant={isMember ? "success" : "orange"}
            size="sm"
            text={isMember ? memberLabel : guestLabel}
            icon={isMember ? "✅" : "👤"}
            {...props}
        />
    );
}

export function GenderBadge({ gender, ...props }: { gender: string } & Omit<BadgeProps, 'text' | 'icon'>) {
    const isMale = gender?.toLowerCase() === 'male';

    return (
        <Badge
            variant={isMale ? "info" : "pink"}
            size="sm"
            text={gender}
            icon={isMale ? '👨' : '👩'}
            {...props}
        />
    );
}
