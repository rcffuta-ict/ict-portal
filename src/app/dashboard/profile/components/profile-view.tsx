"use client";

import { User, MapPin, BookOpen, Shield, Loader2 } from "lucide-react";
import { useProfileStore } from "@/lib/stores/profile.store";
import { DepartmentUtils } from "@rcffuta/ict-lib";

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
    const { profile, location, academics, roles, unit, teams } = userProfile;

    // Format Helper
    const formatDate = (dateString?: string) => {
        if (!dateString) return "Not Set";
        return new Date(dateString).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    const getRoleCategories = () => {
        const badges = new Set<string>();

        // 1. Leadership Roles
        if (roles && roles.length > 0) {
            roles.forEach((role) => {
                switch (role.scope) {
                    case "PRESIDENT":
                        badges.add("President");
                        break;
                    case "CENTRAL":
                        badges.add("Central");
                        break;
                    case "ZONE":
                        badges.add("Hall Pastor"); // Distinction for delegates
                        break;
                    case "UNIT":
                    case "LEVEL":
                    case "TEAM":
                        badges.add("Executive"); // Unit/Team/Level Heads
                        break;
                    default:
                        break;
                }
            });
        }

        // 2. Worker Status
        // If they are in a unit, they are a worker.
        // Even if they are a Hall Pastor, they are likely a worker in a unit too.
        if (unit) {
            badges.add("Worker");
        }

        // 3. Member Fallback
        if (badges.size === 0) {
            return ["Member"];
        }

        // Sort to ensure President comes first
        return Array.from(badges).sort((a, b) => {
            const priority = [
                "President",
                "Central",
                "Executive",
                "Hall Pastor",
                "Worker",
            ];
            return priority.indexOf(a) - priority.indexOf(b);
        });
    };;

    // Build display values
    const user = {
        fullName: `${profile.firstName} ${profile.middleName ? profile.middleName + " " : ""}${profile.lastName}`,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phoneNumber,
        gender: profile.gender,
        dob: formatDate(profile.dob),
        avatarUrl: profile.avatarUrl,

        // Academic
        matric: academics?.matricNumber || "Not Set",
        dept: academics?.department
            ? DepartmentUtils.getByAlias(academics.department)?.name ||
              academics.department
            : "Not Set",

        faculty: academics?.faculty || "Not Set",
        level: academics?.currentLevel || "Not Set",
        family: academics?.family || "Not Set",
        entryYear: academics?.entryYear?.toString() || "Not Set",

        // Location
        hostel: location?.schoolAddress || "Not Set",
        home: location?.homeAddress || "Not Set",
        zone: location?.residentialZone || "Unassigned",

        // Fellowship
        unit: unit?.name || "None",
        // If roles exist, map titles. If not, check if they have a unit to call them a "Worker", else "Member".
        rolesDisplay: getRoleCategories(),

        teamsList:
            teams && teams.length > 0
                ? teams.map((t) => t.name).join(", ")
                : "No Teams",
    };

    return (
        <div className="grid gap-6 md:grid-cols-3 animate-in fade-in duration-500">
            {/* 1. The Digital ID Card (Left Column) */}
            <div className="md:col-span-1 space-y-6">
                <div className="relative overflow-hidden rounded-2xl bg-rcf-navy text-white shadow-xl">
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-white/5 blur-3xl"></div>

                    <div className="p-6 flex flex-col items-center text-center">
                        {/* Avatar Logic */}
                        <div className="h-28 w-28 rounded-full border-4 border-white/20 bg-white/10 flex items-center justify-center text-3xl font-bold mb-4 overflow-hidden shadow-inner">
                            {user.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    alt="Profile"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span>
                                    {user.firstName[0]}
                                    {user.lastName[0]}
                                </span>
                            )}
                        </div>

                        <h2 className="text-xl font-bold leading-tight">
                            {user.firstName} <br /> {user.lastName}
                        </h2>
                        <p className="text-sm text-gray-300 mt-1 mb-4 font-mono tracking-wide">
                            {user.email}
                        </p>

                        {/* Roles Badges */}
                        <div className="flex flex-wrap justify-center gap-2 mb-6">
                            {user.rolesDisplay.map((role, index) => {
                                let colorClass = "bg-slate-100 text-slate-700"; // Default (Worker/Member)

                                if (role === "The President")
                                    colorClass =
                                        "bg-yellow-100 text-yellow-800 border-yellow-200";
                                else if (role === "Central Executive")
                                    colorClass =
                                        "bg-purple-100 text-purple-800 border-purple-200";
                                else if (role === "Exco")
                                    colorClass =
                                        "bg-blue-100 text-blue-800 border-blue-200";
                                else if (role === "Hall Pastor")
                                    colorClass =
                                        "bg-orange-100 text-orange-800 border-orange-200";

                                return (
                                    <span
                                        key={index}
                                        className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm border ${colorClass}`}
                                    >
                                        {role}
                                    </span>
                                );
                            })}
                        </div>

                        <div className="w-full border-t border-white/10 pt-4 grid grid-cols-2 gap-2 text-sm">
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">
                                    Level
                                </p>
                                <p className="font-semibold">{user.level}</p>
                            </div>
                            <div className="text-center border-l border-white/10">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">
                                    Unit
                                </p>
                                <p className="font-semibold truncate px-1">
                                    {user.unit}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ID Footer */}
                    <div className="bg-[#0f0b29] p-3 text-center text-[9px] text-gray-500 tracking-[0.2em] uppercase font-bold">
                        RCF FUTA Digital Identity
                    </div>
                </div>

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
    return (
        <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                {label}
            </p>
            <p className="text-sm font-medium text-slate-900 break-words leading-relaxed">
                {value}
            </p>
        </div>
    );
}
