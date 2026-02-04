"use client";

import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { validateCoupon, redeemCoupon } from "../check-in/actions";
import FormInput from "@/components/ui/FormInput";
import {
    ShoppingBag,
    CheckCircle,
    XCircle,
    Gift,
    Loader2,
    X,
    Keyboard,
    ScanLine,
    AlertTriangle,
    UserCheck,
} from "lucide-react";

interface CouponData {
    registrationId: string;
    participantName: string;
    couponCode: string;
}

export default function VendorScanner() {
    const [mode, setMode] = useState<"scan" | "manual">("scan");
    const [scanning, setScanning] = useState(true);
    const [couponInput, setCouponInput] = useState("");
    const [loading, setLoading] = useState(false);
    
    const [validatedCoupon, setValidatedCoupon] = useState<CouponData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ name: string; code: string } | null>(null);

    const handleScan = async (results: { rawValue: string }[]) => {
        if (!scanning || !results || results.length === 0) return;
        
        const text = results[0].rawValue;
        if (!text) return;
        
        setScanning(false);
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(50);
        
        await validateCouponCode(text);
    };

    const validateCouponCode = async (code: string) => {
        setLoading(true);
        setError(null);
        setValidatedCoupon(null);
        
        try {
            const result = await validateCoupon(code);

            // console.debug("Validation result for code", code, ":", result);
            
            if (result.success && result.data) {
                if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([100, 50, 100]);
                setValidatedCoupon(result.data);
            } else {
                if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(400);
                setError(result.error || "Invalid coupon");
            }
        } catch {
            setError("Failed to validate coupon");
        } finally {
            setLoading(false);
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!couponInput.trim()) return;
        
        await validateCouponCode(couponInput.trim());
    };

    const handleRedeem = async () => {
        if (!validatedCoupon) return;
        
        setLoading(true);
        
        try {
            const result = await redeemCoupon(validatedCoupon.registrationId);
            
            if (result.success) {
                if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
                setSuccess({
                    name: validatedCoupon.participantName,
                    code: validatedCoupon.couponCode
                });
                setValidatedCoupon(null);
            } else {
                setError(result.error || "Failed to redeem");
            }
        } catch {
            setError("Failed to redeem coupon");
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setValidatedCoupon(null);
        setError(null);
        setSuccess(null);
        setCouponInput("");
        setTimeout(() => setScanning(true), 300);
    };

    return (
        <div className="min-h-screen bg-slate-900 font-sans">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 p-4">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-500 p-2 rounded-lg">
                            <ShoppingBag className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-white font-bold">Vendor Scanner</h1>
                            <p className="text-slate-400 text-xs">Agape &apos;26 Coupon System</p>
                        </div>
                    </div>
                    
                    {/* Mode Toggle */}
                    <div className="flex gap-1 bg-slate-700 p-1 rounded-lg">
                        <button
                            onClick={() => { setMode("scan"); reset(); }}
                            className={`p-2 rounded-md transition-all ${mode === "scan" ? "bg-amber-500 text-white" : "text-slate-400 hover:text-white"}`}
                        >
                            <ScanLine className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => { setMode("manual"); reset(); }}
                            className={`p-2 rounded-md transition-all ${mode === "manual" ? "bg-amber-500 text-white" : "text-slate-400 hover:text-white"}`}
                        >
                            <Keyboard className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-lg mx-auto p-4">
                {/* Success Overlay */}
                {success && (
                    <div className="fixed inset-0 z-50 bg-green-900/95 flex items-center justify-center p-6" onClick={reset}>
                        <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full animate-in zoom-in-95">
                            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="h-10 w-10 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-green-700 mb-2">Coupon Invalidated!</h2>
                            <p className="text-slate-600 mb-1">{success.name}</p>
                            <p className="font-mono text-lg font-bold text-slate-900">{success.code}</p>
                            
                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold animate-pulse">
                                    Tap to Scan Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && !validatedCoupon && (
                    <div className="bg-red-900/50 border border-red-500/50 rounded-2xl p-6 mb-4 text-center">
                        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                        <h3 className="text-xl font-bold text-white mb-1">Invalid Coupon</h3>
                        <p className="text-red-200">{error}</p>
                        <button
                            onClick={reset}
                            className="mt-4 px-6 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Validated Coupon - Ready to Redeem */}
                {validatedCoupon && (
                    <div className="bg-linear-to-br from-amber-500 to-amber-600 rounded-2xl p-6 mb-4 text-white">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-lg">
                                    <Gift className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-amber-100 text-sm">Valid Coupon</p>
                                    <p className="font-mono font-bold text-xl">{validatedCoupon.couponCode}</p>
                                </div>
                            </div>
                            <button onClick={reset} className="p-1 hover:bg-white/10 rounded">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="bg-white/10 rounded-xl p-4 mb-4">
                            <p className="text-amber-100 text-sm mb-1">Attendee</p>
                            <p className="font-bold text-lg">{validatedCoupon.participantName}</p>
                        </div>

                        <div className="bg-white rounded-xl p-4 mb-4 text-center">
                            <div className="flex items-center justify-center gap-2 text-teal-600 mb-2">
                                <UserCheck className="h-5 w-5" />
                                <span className="font-bold uppercase text-sm tracking-wider">Coupon Status</span>
                            </div>
                            <p className="text-2xl font-bold text-green-600">✓ VALID</p>
                            <p className="text-slate-500 text-sm">Ready to be redeemed</p>
                        </div>

                        <div className="bg-amber-600/50 rounded-xl p-3 mb-4 flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-200 shrink-0" />
                            <p className="text-sm text-amber-100">
                                This action is irreversible. Only invalidate after giving items.
                            </p>
                        </div>

                        <button
                            onClick={handleRedeem}
                            disabled={loading}
                            className="w-full py-4 bg-white text-amber-600 rounded-xl font-bold text-lg hover:bg-amber-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle className="h-5 w-5" />
                                    Invalidate Coupon
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Scanner View */}
                {mode === "scan" && !validatedCoupon && !error && (
                    <div className="relative bg-black rounded-2xl overflow-hidden aspect-square">
                        <Scanner
                            onScan={handleScan}
                            scanDelay={500}
                            components={{ finder: false }}
                            constraints={{ facingMode: "environment" }}
                            styles={{ container: { height: "100%", width: "100%" } }}
                        />

                        {loading ? (
                            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                                <Loader2 className="h-12 w-12 text-amber-500 animate-spin" />
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="relative w-56 h-56">
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-500 rounded-tl-xl"></div>
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-500 rounded-tr-xl"></div>
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-500 rounded-bl-xl"></div>
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-500 rounded-br-xl"></div>
                                    <div className="absolute inset-x-4 top-0 h-0.5 bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
                                </div>
                            </div>
                        )}

                        <div className="absolute bottom-4 left-0 right-0 text-center">
                            <p className="text-white/70 text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
                                Scan attendee&apos;s coupon QR code
                            </p>
                        </div>
                    </div>
                )}

                {/* Manual Input View */}
                {mode === "manual" && !validatedCoupon && !error && (
                    <div className="bg-slate-800 rounded-2xl p-6">
                        <div className="text-center mb-6">
                            <div className="bg-amber-500/20 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Keyboard className="h-8 w-8 text-amber-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Enter Coupon Code</h2>
                            <p className="text-slate-400 text-sm">Type the attendee&apos;s coupon code</p>
                        </div>

                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <FormInput
                                type="text"
                                placeholder="AG26-XXXXX"
                                value={couponInput}
                                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                className="text-center font-mono text-xl tracking-widest uppercase"
                            />
                            <button
                                type="submit"
                                disabled={loading || !couponInput.trim()}
                                className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Gift className="h-5 w-5" />
                                        Validate Coupon
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Instructions */}
                <div className="mt-6 bg-slate-800 rounded-xl p-4">
                    <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-wider">How It Works</h3>
                    <ol className="space-y-2 text-sm text-slate-400">
                        <li className="flex gap-2">
                            <span className="bg-amber-500 text-white h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                            <span>Scan or enter the attendee&apos;s coupon code</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="bg-amber-500 text-white h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                            <span>Verify the attendee&apos;s name matches</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="bg-amber-500 text-white h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                            <span>Give items to attendee, then invalidate the coupon</span>
                        </li>
                    </ol>
                </div>
            </main>

            <style>{`
                @keyframes scan {
                    0% { top: 5%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 95%; opacity: 0; }
                }
            `}</style>
        </div>
    );
}
