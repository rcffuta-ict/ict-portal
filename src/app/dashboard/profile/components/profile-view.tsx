"use client";

import { User, MapPin, BookOpen, Shield, Loader2 } from "lucide-react";
import { useProfileStore } from "@/lib/stores/profile.store";
import clsx from "clsx";
import { extractUserProfileInfo } from "@/lib/utils";
import { IdentityCard } from "@/components/ui/IdentityCard";

export function ProfileView() {
    const userProfile = useProfileStore((state) => state.user);

    // Guard: if no user data loaded yet
    if (!userProfile) {
        return (
            <div className="flex items-center justify-center min-h-[500px]">
                <p className="text-slate-500 flex items-center gap-2">
                    <Loader2 className="animate-spin h-5 w-5" /> Loading
                    profile...
                </p>
            </div>
        );
    }

    // Destructure for easier access
    const user = extractUserProfileInfo(userProfile);


    return (
        <div className="grid gap-6 md:grid-cols-3 animate-in fade-in duration-500">
            {/* 1. The Digital ID Card (Left Column) */}
            <div className="md:col-span-1 space-y-6">
                <IdentityCard profile={user} />

                {/* Family Badge */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-bold">
                        Class Set / Family
                    </p>
                    <p className="text-lg font-bold text-rcf-navy">
                        {user.family}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        ({user.entryYear} Set)
                    </p>
                </div>
            </div>

            {/* 2. Detailed Info (Right Column) */}
            <div className="md:col-span-2 space-y-6">
                {/* Bio Data Section */}
                <InfoSection title="Personal Information" icon={User}>
                    <InfoItem label="Full Name" value={user.fullName} />
                    <InfoItem label="Email Address" value={user.email} />
                    <InfoItem label="Phone Number" value={user.phone} />
                    <div className="grid grid-cols-2 gap-4">
                        <InfoItem label="Gender" value={user.gender} />
                        <InfoItem label="Date of Birth" value={user.dob} />
                    </div>
                </InfoSection>

                {/* Academic Section */}
                <InfoSection title="Academic Details" icon={BookOpen}>
                    <InfoItem label="Department" value={user.dept} />
                    <InfoItem label="Faculty" value={user.faculty} />
                    <InfoItem label="Matric Number" value={user.matric} />
                    <div className="grid grid-cols-2 gap-4">
                        <InfoItem label="Current Level" value={user.level} />
                        <InfoItem label="Entry Year" value={user.entryYear} />
                    </div>
                </InfoSection>

                {/* Location Section */}
                <InfoSection title="Location" icon={MapPin}>
                    <InfoItem label="Residential Zone" value={user.zone} />
                    <InfoItem
                        label="School Residence (Hostel)"
                        value={user.hostel}
                    />
                    <InfoItem
                        label="Home Address (Holiday)"
                        value={user.home}
                    />
                </InfoSection>

                {/* Fellowship Section */}
                <InfoSection title="Fellowship & Workforce" icon={Shield}>
                    <InfoItem label="Primary Unit" value={user.unit} />
                    <InfoItem
                        label="Teams / Committees"
                        value={user.teamsList}
                    />
                    <InfoItem
                        label="Roles"
                        value={user.rolesDisplay.join(", ")}
                    />
                </InfoSection>
            </div>
        </div>
    );
}

// --- Helper Components ---

interface InfoSectionProps {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}

function InfoSection({ title, icon: Icon, children }: InfoSectionProps) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm text-slate-500">
                    <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                    {title}
                </h3>
            </div>
            <div className="p-6 grid gap-y-6 gap-x-8 sm:grid-cols-2">
                {children}
            </div>
        </div>
    );
}

function InfoItem({ label, value }: { label: string; value: string }) {
    let className = '';
    if (label.toLowerCase() === "gender") {
        className = 'capitalize'
    }
    return (
        <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                {label}
            </p>
            <p className={clsx("text-sm font-medium text-slate-900 break-words leading-relaxed", className)}>
                {value}
            </p>
        </div>
    );
}
