"use client";

import { useState } from "react";
import { ProfileView } from "@/components/profile/profile-view";
import { ProfileEdit } from "@/components/profile/profile-edit";
import { LayoutDashboard, Edit3 } from "lucide-react";
import { useProfileStore } from "@/lib/stores/profile.store";

// TODO: Add server action or API call to fetch user profile
// Example:
// import { getUserProfile } from "./actions";
// Then in useEffect:
// useEffect(() => {
//     async function loadProfile() {
//         const profile = await getUserProfile();
//         setUser(profile);
//     }
//     loadProfile();
// }, []);

export default function ProfilePage() {
    const [activeTab, setActiveTab] = useState<"view" | "edit">("view");

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header with Tabs */}
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-rcf-navy">
                        Membership Profile
                    </h1>
                    <p className="text-sm text-slate-500">
                        Manage your identity and academic records
                    </p>
                </div>

                {/* Custom Tab Switcher */}
                <div className="flex rounded-lg bg-slate-100 p-1">
                    <button
                        onClick={() => setActiveTab("view")}
                        className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                            activeTab === "view"
                                ? "bg-white text-rcf-navy shadow-sm"
                                : "text-slate-500 hover:text-rcf-navy"
                        }`}
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab("edit")}
                        className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                            activeTab === "edit"
                                ? "bg-white text-rcf-navy shadow-sm"
                                : "text-slate-500 hover:text-rcf-navy"
                        }`}
                    >
                        <Edit3 className="h-4 w-4" />
                        Update Details
                    </button>
                </div>
            </div>

            {/* Dynamic Content */}
            <div className="min-h-125">
                {activeTab === "view" ? (
                    <div className="animate-slide-up">
                        <ProfileView />
                    </div>
                ) : (
                    <div className="animate-slide-up">
                        {/* Info Box before editing */}
                        <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
                            <strong>Note:</strong> Changes to Academic Level or
                            Department might require Admin verification in some
                            cases. Please ensure data accuracy.
                        </div>
                        <ProfileEdit />
                    </div>
                )}
            </div>
        </div>
    );
}
