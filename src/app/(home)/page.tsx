
"use client";

import { Logo } from "@/components/ui/logo";
import { Preloader } from "@/components/ui/preloader";
import { LogInIcon, Sparkles, UserPlus, User, Calendar, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { useProfileStore } from "@/lib/stores/profile.store";
import { useEffect, useState } from "react";

export default function ComingSoon() {
    const { user, userId } = useProfileStore();
    const [mounted, setMounted] = useState(false);

    // Handle hydration mismatch
    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    const isAuthenticated = mounted && (!!user || !!userId);
    const profile = user?.profile;

    if (!mounted) {
        return (
            <Preloader 
                title="RCF FUTA Portal" 
                subtitle="Loading your experience..." 
            />
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-slate-50 via-blue-50 to-slate-50">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-rcf-navy/5 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
            </div>

            <main className="relative max-w-3xl w-full text-center px-6 py-16">
                {/* Logo */}
                <div className="flex justify-center mb-8 animate-fade-in">
                    <Logo
                        variant="colored"
                        width={160}
                        className="mx-auto drop-shadow-lg"
                    />
                </div>

                {isAuthenticated ? (
                    // Authenticated User View - Temporary until landing page is ready
                    <>
                        {/* Welcome Message */}
                        <div className="mb-8 animate-fade-in space-y-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold mb-4">
                                <User className="h-4 w-4" />
                                Welcome Back, {profile?.firstName || 'Friend'}!
                            </div>
                            
                            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                                Portal Under Construction
                            </h1>
                            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                                We&apos;re building an amazing new experience for RCF FUTA. 
                                While we work on the full portal, you can access your dashboard and available features.
                            </p>
                        </div>

                        {/* Quick Access Card */}
                        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100 animate-fade-in">
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">
                                Quick Access
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Access available features while we continue building the portal.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link
                                    href="/dashboard"
                                    className="group flex items-center justify-center gap-2 bg-rcf-navy text-white px-8 py-4 rounded-xl font-bold text-base shadow-lg hover:bg-rcf-navy-light transition-all hover:-translate-y-1 hover:shadow-xl"
                                >
                                    <Settings className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                    Dashboard
                                </Link>

                                <Link
                                    href="/events"
                                    className="group flex items-center justify-center gap-2 bg-white text-rcf-navy border-2 border-rcf-navy px-8 py-4 rounded-xl font-bold text-base hover:bg-rcf-navy hover:text-white transition-all hover:-translate-y-1 hover:shadow-lg"
                                >
                                    <Calendar className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                    Events
                                </Link>

                                <Link
                                    href="/api/auth/logout"
                                    className="group flex items-center justify-center gap-2 bg-gray-100 text-gray-700 border-2 border-gray-300 px-6 py-4 rounded-xl font-medium text-base hover:bg-red-500 hover:text-white hover:border-red-500 transition-all hover:-translate-y-1 hover:shadow-lg"
                                >
                                    <LogOut className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                    Logout
                                </Link>
                            </div>
                        </div>

                        {/* User Status Info */}
                        <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200 animate-fade-in">
                            <div className="flex items-center gap-3 text-blue-800">
                                <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
                                    <User className="h-4 w-4" />
                                </div>
                                <div className="text-left">
                                    <p className="font-semibold">Logged in as {profile?.firstName} {profile?.lastName}</p>
                                    <p className="text-sm text-blue-600">{profile?.email || 'RCF FUTA Member'}</p>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    // Non-authenticated User View - Coming Soon Message
                    <>
                        {/* Main heading */}
                        <div className="mb-8 animate-fade-in space-y-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-rcf-navy rounded-full text-sm font-semibold mb-4">
                                <Sparkles className="h-4 w-4" />
                                Coming Soon
                            </div>
                            
                            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                                RCF FUTA Portal
                            </h1>
                            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                                We&apos;re building an amazing digital experience for the RCF FUTA community. 
                                Stay tuned for updates!
                            </p>
                        </div>

                        {/* Info card */}
                        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100 animate-fade-in">
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">
                                Join Us Early
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Be among the first to experience the new RCF FUTA digital portal. 
                                Register now to get early access when we launch.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link
                                    href="/register"
                                    className="group flex items-center justify-center gap-2 bg-rcf-navy text-white px-8 py-4 rounded-xl font-bold text-base shadow-lg hover:bg-rcf-navy-light transition-all hover:-translate-y-1 hover:shadow-xl"
                                >
                                    <UserPlus className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                    Register Now
                                </Link>

                                <Link
                                    href="/login"
                                    className="group flex items-center justify-center gap-2 bg-white text-rcf-navy border-2 border-rcf-navy px-8 py-4 rounded-xl font-bold text-base hover:bg-rcf-navy hover:text-white transition-all hover:-translate-y-1 hover:shadow-lg"
                                >
                                    <LogInIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                    Login
                                </Link>
                            </div>
                        </div>
                    </>
                )}

                {/* Additional info */}
                <div className="text-sm text-gray-500 space-y-2 animate-fade-in">
                    {!isAuthenticated && (
                        <p>Already have an account? Login to access your dashboard.</p>
                    )}
                    <p className="text-xs">
                        Questions? Contact the ICT Team at <span className="font-semibold text-rcf-navy">ict@rcffuta.com</span>
                    </p>
                </div>
            </main>
        </div>
    );
}
