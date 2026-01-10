import Link from "next/link";
import { ArrowLeft, Home, MapPinOff } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
            {/* 1. Visual Icon */}
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-100 rounded-full blur-2xl opacity-50 animate-pulse"></div>
                <div className="relative bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                    <MapPinOff className="h-16 w-16 text-rcf-navy" />
                </div>
            </div>

            {/* 2. Text Content */}
            <div className="max-w-md space-y-4">
                <h1 className="text-6xl font-black text-slate-200 tracking-tighter">
                    404
                </h1>
                <h2 className="text-2xl font-bold text-slate-900">
                    Lost in the Wilderness?
                </h2>
                <p className="text-slate-500 leading-relaxed">
                    The page you are looking for seems to have wandered off the
                    path. Don't worry, even the lost sheep gets found.
                </p>
            </div>

            {/* 3. Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                <Link
                    href="/"
                    className="flex items-center justify-center gap-2 bg-rcf-navy text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-[#2a2257] transition-all hover:-translate-y-0.5"
                >
                    <Home className="h-4 w-4" />
                    Return Home
                </Link>
            </div>

            {/* 4. Footer Help */}
            <p className="mt-12 text-xs text-slate-400">
                If you believe this is an error, please contact the{" "}
                <Link href="mailto:ict@rcffuta.com" className="font-bold text-rcf-navy">ICT Team</Link>.
            </p>
        </div>
    );
}
