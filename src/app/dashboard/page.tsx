"use client";
import Link from "next/link";
import {
    UserCircle,
    QrCode,
    BookOpen,
    Vote,
    Wallet,
    CalendarCheck,
} from "lucide-react";
// import { RcfIctClient } from "@rcffuta/ict-lib";
// import { getActiveTenureName } from "@/utils/action";
import { useProfileStore } from "@/lib/stores/profile.store";
import { useTenureStore } from "@/lib/stores/tenure.store";


export default function DashboardHome() {
    const tenureName = useTenureStore(s => s.activeTenure?.name || null);
    const userFirstName = useProfileStore(s=>s.user?.profile.firstName || "Melchizedeck"); // We will pull this from lib later

    return (
        <div className="space-y-8">
            {/* 1. Welcome Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-rcf-navy">
                    Welcome back, {userFirstName} 👋
                </h1>
                {tenureName && <p className="text-gray-500">
                    {/* Rebranding Tenure • 2nd Semester 2024/2025 */}
                    {tenureName}
                </p>}
            </div>
            {/* 2. Services Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <ServiceCard
                    href="/dashboard/profile"
                    title="My Identity"
                    desc="Manage bio-data, academic info & ID Card."
                    icon={UserCircle}
                    color="bg-blue-500"
                />

                {/* <ServiceCard
                    href="/dashboard/attendance"
                    title="Attendance"
                    desc="Scan QR codes for Service & Unit meetings."
                    icon={QrCode}
                    color="bg-purple-500"
                />

                <ServiceCard
                    href="/dashboard/academics"
                    title="Academic Hub"
                    desc="CGPA Calculator & Past Questions."
                    icon={BookOpen}
                    color="bg-emerald-500"
                />

                <ServiceCard
                    href="/dashboard/voting"
                    title="Elections"
                    desc="Vote for FYB and Executive roles."
                    icon={Vote}
                    color="bg-orange-500"
                />

                <ServiceCard
                    href="/dashboard/dues"
                    title="Financials"
                    desc="Pay offering, dues, and pledges."
                    icon={Wallet}
                    color="bg-pink-500"
                />

                <ServiceCard
                    href="/dashboard/events"
                    title="Events"
                    desc="Register for conferences and retreats."
                    icon={CalendarCheck}
                    color="bg-indigo-500"
                /> */}
            </div>
        </div>
    );
}

// Reusable Service Card Component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ServiceCard({ href, title, desc, icon: Icon, color }: any) {
    return (
        <Link
            href={href}
            className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:border-rcf-navy/30 hover:-translate-y-1"
        >
            <div className="space-y-4">
                <div
                    className={`inline-flex rounded-lg p-3 text-white ${color}`}
                >
                    <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-bold text-gray-900 group-hover:text-rcf-navy transition-colors">
                        {title}
                    </h3>
                    <p className="text-sm text-gray-500">{desc}</p>
                </div>
            </div>

            {/* Decorative gradient on hover */}
            <div className="absolute inset-x-0 bottom-0 h-1 scale-x-0 bg-rcf-navy transition-transform duration-300 group-hover:scale-x-100" />
        </Link>
    );
}
