"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Phone,
  Mail,
  Loader2,
  AlertCircle,
  UserCheck,
  Gift,
  X,
  ShoppingBag,
  PartyPopper,
  Clock,
  Calendar,
  MapPin,
  Sparkles,
  ArrowRight,
  Download,
} from "lucide-react";
import QRCode from "react-qr-code";
import { findRegistrationByIdentifier, completeCheckIn } from "../actions";
import { SinglesWeekendFooter } from "@/components/events/footer";

interface VerifiedData {
  registrationId: string;
  participantName: string;
  firstName: string;
  email?: string;
  gender?: string;
  hasCoupon?: boolean;
  couponCode?: string;
}

interface CheckedInData {
  participantName: string;
  firstName: string;
  checkedInAt: string;
  wantsCoupon?: boolean;
  couponCode?: string;
  hasUsedCoupon?: boolean;
}

type Step = "identify" | "loading" | "verified" | "checking-in" | "complete" | "error";

export default function SelfCheckInPage() {
  const [step, setStep] = useState<Step>("identify");
  const [inputType, setInputType] = useState<"phone" | "email">("phone");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifiedData, setVerifiedData] = useState<VerifiedData | null>(null);
  const [checkedInData, setCheckedInData] = useState<CheckedInData | null>(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const couponRef = useRef<HTMLDivElement>(null);

  // Format coupon code for display (show full code, uppercase)
  const formatCouponCode = (code: string) => code.toUpperCase();

  // Download coupon as image
  const downloadCoupon = () => {
    if (!checkedInData?.couponCode) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Coupon card dimensions
    const width = 600;
    const height = 900;
    canvas.width = width;
    canvas.height = height;
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0d9488');
    gradient.addColorStop(0.4, '#0d9488');
    gradient.addColorStop(0.4, '#fffbeb');
    gradient.addColorStop(1, '#fef3c7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Header section
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SINGLES WEEKEND', width / 2, 50);
    
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('AGAPE \'26', width / 2, 110);
    
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = '#ccfbf1';
    ctx.fillText('Feb 14-15, 2026 • Southgate Auditorium', width / 2, 150);
    
    // Hearts decoration
    ctx.font = '36px system-ui, sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('❤', 50, 80);
    ctx.fillText('❤', width - 50, 80);
    
    // Coupon card area
    const cardY = 200;
    const cardHeight = 650;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(30, cardY, width - 60, cardHeight, 24);
    ctx.fill();
    
    // Dashed border effect
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Coupon title
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText('🎁 SHOPPING COUPON', width / 2, cardY + 60);
    
    // Attendee name
    ctx.fillStyle = '#64748b';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Issued to:', width / 2, cardY + 110);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(checkedInData.participantName, width / 2, cardY + 145);
    
    // QR Code section
    const qrSize = 200;
    const qrX = (width - qrSize) / 2;
    const qrY = cardY + 180;
    
    // QR background
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 16);
    ctx.fill();
    
    // Get QR SVG and draw it
    const couponCode = formatCouponCode(checkedInData.couponCode);
    const qrSvg = couponRef.current?.querySelector('svg');
    
    if (qrSvg) {
      const svgData = new XMLSerializer().serializeToString(qrSvg);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
        
        // Continue drawing after QR loads
        finishCouponCanvas(ctx, width, cardY, couponCode, canvas);
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } else {
      // Fallback if no QR SVG
      finishCouponCanvas(ctx, width, cardY, couponCode, canvas);
    }
  };
  
  const finishCouponCanvas = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    cardY: number, 
    couponCode: string,
    canvas: HTMLCanvasElement
  ) => {
    // Code display
    ctx.fillStyle = '#1e293b';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOUR CODE', width / 2, cardY + 430);
    
    ctx.font = 'bold 42px monospace';
    ctx.fillStyle = '#0d9488';
    ctx.fillText(couponCode, width / 2, cardY + 480);
    
    // Instructions
    ctx.fillStyle = '#64748b';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Show this coupon to a vendor', width / 2, cardY + 540);
    ctx.fillText('to claim your free items!', width / 2, cardY + 565);
    
    // Valid indicator
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(width / 2 - 60, cardY + 610, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('✓ VALID COUPON', width / 2 + 10, cardY + 616);
    
    // Download
    const link = document.createElement('a');
    link.download = `agape26-coupon-${couponCode}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identifier.trim()) {
      setError(inputType === "phone" ? "Please enter your phone number" : "Please enter your email");
      return;
    }
    
    setStep("loading");
    setError(null);
    
    try {
      const result = await findRegistrationByIdentifier(identifier.trim());
      
      if (!result.success) {
        setError(result.error || "Registration not found");
        setStep("error");
        return;
      }

      if (result.alreadyCheckedIn && result.data) {
        setAlreadyCheckedIn(true);
        setCheckedInData({
          participantName: result.data.participantName,
          firstName: result.data.firstName,
          checkedInAt: result.data.checkedInAt,
          wantsCoupon: result.data.wantsCoupon,
          couponCode: result.data.couponCode,
          hasUsedCoupon: result.data.hasUsedCoupon
        });
        setStep("complete");
        return;
      }

      if (result.verified && result.data) {
        // If user already has a coupon assigned, skip to check-in directly
        if (result.data.hasCoupon && result.data.couponCode) {
          // Complete check-in automatically with the existing coupon
          setVerifiedData({
            registrationId: result.data.registrationId,
            participantName: result.data.participantName,
            firstName: result.data.firstName,
            email: result.data.email,
            gender: result.data.gender,
            hasCoupon: true,
            couponCode: result.data.couponCode
          });
          // Auto-complete check-in since they already have a coupon
          handleCompleteCheckIn(true, result.data.registrationId);
          return;
        }
        
        setVerifiedData({
          registrationId: result.data.registrationId,
          participantName: result.data.participantName,
          firstName: result.data.firstName,
          email: result.data.email,
          gender: result.data.gender,
          hasCoupon: false
        });
        setStep("verified");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setStep("error");
    }
  };

  const handleCompleteCheckIn = async (wantsCoupon: boolean, overrideRegistrationId?: string) => {
    const registrationId = overrideRegistrationId || verifiedData?.registrationId;
    if (!registrationId) return;
    
    setStep("checking-in");
    
    try {
      const result = await completeCheckIn(registrationId, wantsCoupon);
      
      if (!result.success) {
        setError(result.error || "Check-in failed");
        setStep("error");
        return;
      }

      if (result.data) {
        setCheckedInData({
          participantName: result.data.participantName,
          firstName: result.data.firstName,
          checkedInAt: result.data.checkedInAt,
          wantsCoupon: result.data.wantsCoupon,
          couponCode: result.data.couponCode,
          hasUsedCoupon: result.data.hasUsedCoupon
        });
        setStep("complete");
      }
    } catch {
      setError("An unexpected error occurred");
      setStep("error");
    }
  };

  const resetFlow = () => {
    setStep("identify");
    setIdentifier("");
    setError(null);
    setVerifiedData(null);
    setCheckedInData(null);
    setAlreadyCheckedIn(false);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-teal-50 via-white to-amber-50 flex items-center justify-center p-4">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 -mr-32 -mt-32 h-96 w-96 rounded-full bg-teal-200 blur-3xl opacity-30" />
        <div className="absolute bottom-0 left-0 -ml-32 -mb-32 h-96 w-96 rounded-full bg-amber-200 blur-3xl opacity-30" />
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Identify */}
        {step === "identify" && (
          <motion.div
            key="identify"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative bg-white rounded-3xl shadow-2xl overflow-hidden max-w-md w-full"
          >
            {/* Header */}
            <div className="bg-linear-to-r from-teal-600 to-teal-700 p-6 text-white text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="hearts-id" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M20 10 C17 4 10 4 7 10 C4 16 10 22 20 32 C30 22 36 16 33 10 C30 4 23 4 20 10" fill="currentColor" opacity="0.3"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#hearts-id)" />
                </svg>
              </div>
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1 text-sm font-medium mb-3">
                  <Heart className="h-4 w-4 fill-current" />
                  Agape &apos;26
                </div>
                
                <div className="flex justify-center mb-3">
                  <UserCheck className="h-14 w-14 text-amber-300" />
                </div>
                
                <h1 className="text-3xl font-bold">Self Check-In</h1>
                <p className="text-teal-100 mt-1">Singles Weekend 2026</p>
              </div>
            </div>

            {/* Content */}
            <form onSubmit={handleLookup} className="p-6 space-y-5">
              <div className="text-center mb-2">
                <p className="text-slate-600">
                  Enter your registration details to check in
                </p>
              </div>

              {/* Input Type Toggle */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setInputType("phone")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all text-sm ${
                    inputType === "phone"
                      ? "bg-white text-teal-600 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  Phone
                </button>
                <button
                  type="button"
                  onClick={() => setInputType("email")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all text-sm ${
                    inputType === "email"
                      ? "bg-white text-teal-600 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Email
                </button>
              </div>

              {/* Input Field */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {inputType === "phone" ? "Phone Number" : "Email Address"}
                </label>
                <input
                  type={inputType === "phone" ? "tel" : "email"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={inputType === "phone" ? "08012345678" : "you@example.com"}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
                  autoFocus
                />
              </div>

              {error && step === "identify" && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-4 rounded-xl font-bold hover:bg-teal-700 transition-all text-lg"
              >
                Find My Registration
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 text-center">
              <p className="text-xs text-slate-400 font-medium">
                Powered by RCF ICT Portal • FUTA
              </p>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {(step === "loading" || step === "checking-in") && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center space-y-6"
          >
            <div className="relative">
              <div className="h-20 w-20 mx-auto bg-teal-100 rounded-full flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-teal-600 animate-spin" />
              </div>
              <div className="absolute -top-2 -right-2 h-6 w-6 bg-amber-400 rounded-full animate-bounce" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {step === "checking-in" ? "Completing Check-In..." : "Finding Your Registration..."}
              </h2>
              <p className="text-slate-500 mt-2">
                {step === "checking-in" ? "Almost there!" : "Just a moment..."}
              </p>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {step === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center space-y-6"
          >
            <div className="h-20 w-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Oops!</h2>
              <p className="text-red-600 mt-2">{error}</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={resetFlow}
                className="w-full bg-slate-900 text-white py-3.5 px-6 rounded-xl font-bold hover:bg-slate-800 transition-all"
              >
                Try Again
              </button>
              <p className="text-sm text-slate-500">
                Need help? Visit the registration desk.
              </p>
            </div>
          </motion.div>
        )}

        {/* Verified - Shopping Interest Prompt */}
        {step === "verified" && verifiedData && (
          <motion.div
            key="verified"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative bg-white rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full"
          >
            {/* Header */}
            <div className="bg-linear-to-r from-teal-600 to-teal-700 p-6 text-white text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="hearts-v" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M20 10 C17 4 10 4 7 10 C4 16 10 22 20 32 C30 22 36 16 33 10 C30 4 23 4 20 10" fill="currentColor" opacity="0.3"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#hearts-v)" />
                </svg>
              </div>
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1 text-sm font-medium mb-3">
                  <Heart className="h-4 w-4 fill-current" />
                  Agape &apos;26
                </div>
                
                <div className="flex justify-center mb-3">
                  <UserCheck className="h-14 w-14 text-amber-300" />
                </div>
                
                <h1 className="text-3xl font-bold">Almost There!</h1>
                <p className="text-teal-100 mt-1">Singles Weekend 2026</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Welcome Card */}
              <div className="bg-slate-50 rounded-2xl p-5 text-center">
                <div className="h-16 w-16 mx-auto bg-teal-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-3xl">👋</span>
                </div>
                <p className="text-sm text-slate-500">Welcome,</p>
                <p className="text-2xl font-bold text-slate-900">{verifiedData.firstName}!</p>
                <p className="text-slate-600 mt-1">{verifiedData.participantName}</p>
              </div>

              {/* Shopping Interest Question */}
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 bg-amber-400 rounded-xl flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Free Shopping</h3>
                    <p className="text-sm text-slate-600">Would you like a coupon for our free shopping?</p>
                  </div>
                </div>
                
                <p className="text-sm text-slate-600 mb-4">
                  We are providing free shopping exercise at the event! If you&apos;re interested, 
                  we&apos;ll give you a special coupon code you can use.
                </p>
                
                <div className="flex md:grid grid-cols-2 gap-3 flex-col">
                  <button
                    onClick={() => handleCompleteCheckIn(true)}
                    className="flex items-center justify-center gap-2 bg-amber-500 text-white py-3 px-4 rounded-xl font-bold hover:bg-amber-600 transition-all"
                  >
                    <Gift className="h-5 w-5" />
                    Yes, I want one!
                  </button>
                  <button
                    onClick={() => handleCompleteCheckIn(false)}
                    className="flex items-center justify-center gap-2 bg-slate-200 text-slate-700 py-3 px-4 rounded-xl font-bold hover:bg-slate-300 transition-all"
                  >
                    <X className="h-5 w-5" />
                    No thanks
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 text-center">
              <p className="text-xs text-slate-400 font-medium">
                Powered by RCF ICT Portal • FUTA
              </p>
            </div>
          </motion.div>
        )}

        {/* Complete - Success Screen */}
        {step === "complete" && checkedInData && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full"
          >
            {/* Header */}
            <div className="bg-linear-to-r from-teal-600 to-teal-700 p-6 text-white text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="hearts-c" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M20 10 C17 4 10 4 7 10 C4 16 10 22 20 32 C30 22 36 16 33 10 C30 4 23 4 20 10" fill="currentColor" opacity="0.3"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#hearts-c)" />
                </svg>
              </div>
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1 text-sm font-medium mb-3">
                  <Heart className="h-4 w-4 fill-current" />
                  Agape &apos;26
                </div>
                
                <div className="flex justify-center mb-3">
                  {alreadyCheckedIn ? (
                    <UserCheck className="h-14 w-14 text-amber-300" />
                  ) : (
                    <PartyPopper className="h-14 w-14 text-amber-300" />
                  )}
                </div>
                
                <h1 className="text-3xl font-bold">
                  {alreadyCheckedIn ? "Welcome Back!" : "You're In!"}
                </h1>
                <p className="text-teal-100 mt-1">Singles Weekend 2026</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Participant Card */}
              <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 bg-teal-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🎉</span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Welcome,</p>
                    <p className="text-xl font-bold text-slate-900">{checkedInData.participantName}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-sm text-slate-600 pt-3 border-t border-slate-200">
                  <Clock className="h-4 w-4 text-teal-600" />
                  <span>
                    {alreadyCheckedIn ? "Checked in" : "Just checked in"} at{" "}
                    {new Date(checkedInData.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Coupon Card */}
              {checkedInData.wantsCoupon && checkedInData.couponCode && (
                <div className="bg-linear-to-br from-amber-50 to-amber-100 rounded-2xl p-5 border-2 border-dashed border-amber-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 bg-amber-400 rounded-xl flex items-center justify-center shrink-0">
                      <Gift className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Your Shopping Coupon</h3>
                      <p className="text-sm text-slate-600">
                        {checkedInData.hasUsedCoupon ? "Already redeemed" : "Show this to claim your free items!"}
                      </p>
                    </div>
                  </div>
                  
                  {checkedInData.hasUsedCoupon ? (
                    <div className="bg-slate-100 rounded-xl p-4 text-center">
                      <p className="font-mono font-bold text-lg text-slate-400 line-through">
                        {formatCouponCode(checkedInData.couponCode)}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">✓ Already Redeemed</p>
                    </div>
                  ) : (
                    <>
                      {/* QR Code */}
                      <div 
                        ref={couponRef}
                        className="bg-white rounded-xl p-4 mb-4 flex flex-col items-center shadow-sm"
                      >
                        <QRCode
                          value={formatCouponCode(checkedInData.couponCode)}
                          size={160}
                          style={{ height: "auto", maxWidth: "100%", width: "160px" }}
                          fgColor="#0d9488"
                        />
                        <div className="mt-4 text-center">
                          <p className="text-xs text-slate-500 uppercase tracking-wider">Coupon Code</p>
                          <p className="font-mono font-bold text-2xl text-teal-700 tracking-wider mt-1">
                            {formatCouponCode(checkedInData.couponCode)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Download Button */}
                      <button
                        onClick={downloadCoupon}
                        className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 transition-all"
                      >
                        <Download className="h-5 w-5" />
                        Download Coupon
                      </button>
                      
                      <p className="text-xs text-amber-700 mt-3 text-center font-medium">
                        💡 Save this coupon to your phone for easy access at vendor stalls
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* No coupon message */}
              {!checkedInData.wantsCoupon && (
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <p className="text-slate-600 text-sm">
                    You opted out of shopping. Enjoy the event! 🎊
                  </p>
                </div>
              )}

              {/* Event Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-teal-50 rounded-xl p-4 text-center">
                  <Calendar className="h-5 w-5 text-teal-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Date</p>
                  <p className="text-sm font-bold text-slate-900">Feb 14-15</p>
                </div>
                <div className="bg-teal-50 rounded-xl p-4 text-center">
                  <MapPin className="h-5 w-5 text-teal-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Venue</p>
                  <p className="text-sm font-bold text-slate-900">Southgate Auditorium</p>
                </div>
              </div>

              {/* Footer Message */}
              <div className="text-center pt-4 border-t border-slate-100">
                <div className="inline-flex items-center gap-2 text-teal-700 font-medium">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Enjoy the Singles Weekend!
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  May you understand the love of God and experience His grace.
                </p>
              </div>
            </div>

            {/* Footer */}
            <SinglesWeekendFooter/>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
