import Link from "next/link";

import { ArrowRight, BookOpen, Users, Calendar } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export default function HomeDesign() {
    return (
        <div className="min-h-screen flex flex-col">
            {/* 1. Navbar */}
            <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 py-6">
                    <div className="flex items-center gap-2">
                        <Logo variant="colored" width={120} asLink />
                    </div>

                    <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
                        <Link href="#" className="hover:text-rcf-navy">
                            About
                        </Link>
                        <Link href="#" className="hover:text-rcf-navy">
                            Units
                        </Link>
                        <Link href="#" className="hover:text-rcf-navy">
                            Events
                        </Link>
                    </nav>

                    <div className="flex gap-3">
                        <Link
                            href="/login"
                            className="px-4 py-2 text-sm font-medium text-rcf-navy hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Sign In
                        </Link>
                        <Link
                            href="/register"
                            className="px-4 py-2 text-sm font-medium bg-rcf-navy text-white hover:bg-rcf-navy-light rounded-md shadow-lg shadow-rcf-navy/20 transition-all"
                        >
                            Join Fellowship
                        </Link>
                    </div>
                </div>
            </header>

            {/* 2. Hero Section */}
            <main className="flex-1">
                <section className="relative overflow-hidden pt-16 pb-32 md:pt-24 lg:pt-32">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="flex flex-col items-center text-center space-y-8 animate-slide-up">
                            <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-800">
                                <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2"></span>
                                Rebranding Tenure 2025/2026
                            </div>

                            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl">
                                One Family. One Faith. {" "}
                                <br className="hidden md:block" />
                                <span className="text-rcf-navy">One Digital Community.</span>
                            </h1>

                            <p className="max-w-[42rem] leading-normal text-gray-500 sm:text-xl sm:leading-8">
                                Welcome to the official digital portal of the Redeemed Christian Fellowship, FUTA. Manage your
                                membership, track attendance, and stay connected.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                                <Link
                                    href="/dashboard"
                                    className="inline-flex h-12 items-center justify-center rounded-lg bg-rcf-navy px-8 text-sm font-medium text-white shadow-xl shadow-rcf-navy/20 transition-transform hover:scale-105"
                                >
                                    Go to Portal
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                                <Link
                                    href="/resources"
                                    className="inline-flex h-12 items-center justify-center rounded-lg border border-gray-200 bg-white px-8 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 hover:text-rcf-navy"
                                >
                                    Access Resources
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Decorative Blob */}
                    <div className="absolute top-0 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue-50 blur-3xl opacity-50 pointer-events-none" />
                </section>

                {/* 3. Features Grid */}
                <section className="container mx-auto px-4 py-12 md:px-6 lg:py-24">
                    <div className="grid gap-8 md:grid-cols-3">
                        <FeatureCard
                            icon={Users}
                            title="Membership Profile"
                            desc="Update your bio-data, academic details, and unit membership instantly."
                        />
                        <FeatureCard
                            icon={Calendar}
                            title="Event Attendance"
                            desc="QR-code based check-in for services, unit meetings, and conferences."
                        />
                        <FeatureCard
                            icon={BookOpen}
                            title="Academic Resources"
                            desc="Access past questions, handouts, and CGPA calculators tailored for FUTA."
                        />
                    </div>
                </section>
            </main>

            {/* 4. Footer */}
            <footer className="border-t border-gray-100 bg-gray-50 py-6 md:py-0">
                <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:h-24 md:flex-row">
                    <p className="text-center text-sm leading-loose text-gray-500 md:text-left">
                        © 2026 RCF FUTA ICT Team. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({
    icon: Icon,
    title,
    desc,
}: {
    icon: any;
    title: string;
    desc: string;
}) {
    return (
        <div className="flex flex-col items-start space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md hover:border-rcf-navy/20">
            <div className="rounded-lg bg-rcf-navy/5 p-3">
                <Icon className="h-6 w-6 text-rcf-navy" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <p className="text-gray-500 leading-relaxed">{desc}</p>
        </div>
    );
}
