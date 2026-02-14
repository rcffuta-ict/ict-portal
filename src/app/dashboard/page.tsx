"use client";
import Link from "next/link";
import {
    Sparkles,
    Code2,
    Calendar,
} from "lucide-react";
import { useProfileStore } from "@/lib/stores/profile.store";
import { useTenureStore } from "@/lib/stores/tenure.store";
import { CompactPreloader } from "@/components/ui/preloader";
import { getSidebarItems, isUserAdmin, eventSidebarItems } from "@/config/sidebar-items";
import type { SidebarItem } from "@/config/sidebar-items";
import { useMemo, useState, useEffect } from "react";
import { getEvents } from "@/app/events/actions";


export default function DashboardHome() {
    const tenureName = useTenureStore(s => s.activeTenure?.name || null);
    const user = useProfileStore(s => s.user);
    const userFirstName = user?.profile.firstName || "Melchizedeck";
    const [dynamicEvents, setDynamicEvents] = useState<SidebarItem[]>([]);

    useEffect(() => {
        async function fetchEvents() {
            const { success, data } = await getEvents();
            if (success && data && Array.isArray(data)) {
                // Determine 'upcoming' or 'active' events logic if needed here
                // User said "only load events that are not exclusive"
                // Assuming we want active events.
                const today = new Date();
                today.setHours(0,0,0,0);

                const mappedEvents: SidebarItem[] = data
                    .filter((e: any) => {
                        // Filter logic:
                        // 1. Must be active
                        // 2. Must NOT be exclusive
                        // 3. Must be upcoming or recurring? Usually dashboards show current/future.
                        // Let's include upcoming + recurring.
                        const eDate = new Date(e.date);
                        const isUpcoming = eDate >= today;
                        // Recurring check? If is_recurring is boolean.
                        // We need access to is_recurring field which might be missing in older event definitions
                        // but getEvents uses select('*').
                        const isRecurring = e.is_recurring === true;

                        return e.is_active && !e.is_exclusive && (isUpcoming || isRecurring);
                    })
                    .map((e: any) => ({
                        name: e.title,
                        href: `/events/${e.slug}`,
                        icon: Calendar,
                        color: "bg-purple-500", // Default color
                        description: e.description || `Event on ${new Date(e.date).toLocaleDateString()}`,
                        section: "Events"
                    }));
                setDynamicEvents(mappedEvents);
            }
        }
        fetchEvents();
    }, []);

    // Check if user is admin
    const isAdmin = useMemo(() => {
        return isUserAdmin(user?.profile?.email);
    }, [user?.profile?.email]);

    // Get service cards (exclude "Overview" for cards display, also exclude events since they have their own section)
    const serviceCards = useMemo(() => {
        // Pass user object to support role-based items (Zone Manager, etc.)
        const items = getSidebarItems(user || null, isAdmin);
        return items.filter(item => item.name !== "Overview" && !item.section);
    }, [user, isAdmin]);

    // Show loading state if user data is not yet available
    if (!user?.profile) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <CompactPreloader
                    title="Loading Dashboard..."
                    subtitle="Getting your data ready"
                    showUserIcon={true}
                />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* 1. Welcome Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-rcf-navy">
                    Welcome back, {userFirstName} 👋
                </h1>
                {tenureName && (
                    <p className="text-gray-500">
                        {/* Rebranding Tenure • 2nd Semester 2024/2025 */}
                        {tenureName}
                    </p>
                )}
            </div>
            {/* 2. Services Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {serviceCards.map((item) => (
                    <ServiceCard
                        key={item.href}
                        item={item}
                    />
                ))}
            </div>

            {/* 3. Events Section */}
            {(eventSidebarItems.length > 0 || dynamicEvents.length > 0) && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-rcf-navy">Upcoming Events</h2>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-pink-100 text-pink-700 rounded-full">
                            <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
                            Live
                        </span>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {/* Combine static and dynamic events, deduping by href */}
                        {[...eventSidebarItems, ...dynamicEvents]
                            .filter((item, index, self) =>
                                index === self.findIndex((t) => t.href === item.href)
                            )
                            .map((item) => (
                                <ServiceCard
                                    key={item.href}
                                    item={item}
                                />
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Coming Soon Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 p-8 shadow-sm">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-blue-200/30 blur-2xl" />
                <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-32 w-32 rounded-full bg-purple-200/30 blur-2xl" />

                <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                    {/* Icon */}
                    <div className="inline-flex rounded-full bg-linear-to-br from-blue-500 to-purple-600 p-4 shadow-lg">
                        <Sparkles className="h-8 w-8 text-white animate-pulse" />
                    </div>

                    {/* Heading */}
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-rcf-navy">
                            More Services Coming Soon!
                        </h2>
                        <p className="text-slate-600 max-w-2xl mx-auto">
                            The ICT Team is working hard to bring you amazing
                            features like
                            <span className="font-semibold text-rcf-navy">
                                {" "}
                                Attendance Tracking
                            </span>
                            ,
                            {/* <span className="font-semibold text-rcf-navy"> Elections</span>,  */}
                            <span className="font-semibold text-rcf-navy">
                                {" "}
                                Event Manager
                            </span>
                            , and more.
                        </p>
                        <p className="text-sm text-slate-500 italic">
                            Come back often to discover new tools! 🚀
                        </p>
                    </div>

                    {/* CTA Badge */}
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-sm px-4 py-2 text-sm font-medium text-rcf-navy shadow-md border border-blue-100">
                        <Code2 className="h-4 w-4" />
                        Built with love by ICT Team
                    </div>
                </div>
            </div>
        </div>
    );
}

// Reusable Service Card Component
interface ServiceCardProps {
    item: SidebarItem;
}

function ServiceCard({ item }: ServiceCardProps) {
    const { href, name, description, icon: Icon, color, comingSoon } = item;

    return (
        <Link
            href={comingSoon ? "#" : href}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-white p-6 shadow-sm transition-all ${
                comingSoon
                    ? "border-gray-300 cursor-not-allowed opacity-75"
                    : "border-gray-200 hover:shadow-lg hover:border-rcf-navy/30 hover:-translate-y-1"
            }`}
            onClick={(e) => comingSoon && e.preventDefault()}
        >
            <div className="space-y-4">
                <div className="flex items-start justify-between">
                    <div
                        className={`inline-flex rounded-lg p-3 text-white ${color}`}
                    >
                        <Icon className="h-6 w-6" />
                    </div>
                    {comingSoon && (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                            Coming Soon
                        </span>
                    )}
                </div>
                <div className="space-y-2">
                    <h3 className={`font-bold ${comingSoon ? "text-gray-700" : "text-gray-900 group-hover:text-rcf-navy"} transition-colors`}>
                        {name}
                    </h3>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
            </div>

            {/* Decorative gradient on hover (only for active cards) */}
            {!comingSoon && (
                <div className="absolute inset-x-0 bottom-0 h-1 scale-x-0 bg-rcf-navy transition-transform duration-300 group-hover:scale-x-100" />
            )}
        </Link>
    );
}
