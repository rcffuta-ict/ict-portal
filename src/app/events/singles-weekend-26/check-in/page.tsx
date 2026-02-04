"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { verifyRegistration, completeCheckIn } from "./actions";
import { 
  UserCheck, 
  Gift, 
  Clock, 
  AlertCircle, 
  Loader2,
  Heart,
  Calendar,
  MapPin,
  Sparkles,
  PartyPopper,
  ShoppingBag,
  X,
} from "lucide-react";

interface VerifiedData {
  registrationId: string;
  participantName: string;
  firstName: string;
  email?: string;
  gender?: string;
}

interface CheckedInData {
  participantName: string;
  firstName: string;
  checkedInAt: string;
  wantsCoupon?: boolean;
  couponCode?: string;
  hasUsedCoupon?: boolean;
}

type CheckInStep = 'loading' | 'verified' | 'checking-in' | 'complete' | 'error';

function CheckInContent() {
  const searchParams = useSearchParams();
  const registrationId = searchParams.get("id");
  
  const [step, setStep] = useState<CheckInStep>('loading');
  const [verifiedData, setVerifiedData] = useState<VerifiedData | null>(null);
  const [checkedInData, setCheckedInData] = useState<CheckedInData | null>(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Verify registration
  const handleVerify = useCallback(async () => {
    if (!registrationId) return;
    
    setStep('loading');
    setError(null);
    
    try {
      const result = await verifyRegistration(registrationId);
      
      if (!result.success) {
        setError(result.error || "Verification failed");
        setStep('error');
        return;
      }

      if (result.alreadyCheckedIn && result.data) {
        // Already checked in - show final screen
        setAlreadyCheckedIn(true);
        setCheckedInData({
          participantName: result.data.participantName,
          firstName: result.data.firstName,
          checkedInAt: result.data.checkedInAt,
          wantsCoupon: result.data.wantsCoupon,
          couponCode: result.data.couponCode,
          hasUsedCoupon: result.data.hasUsedCoupon
        });
        setStep('complete');
        return;
      }

      if (result.verified && result.data) {
        // Show shopping interest prompt
        setVerifiedData({
          registrationId: result.data.registrationId,
          participantName: result.data.participantName,
          firstName: result.data.firstName,
          email: result.data.email,
          gender: result.data.gender
        });
        setStep('verified');
      }
    } catch {
      setError("An unexpected error occurred");
      setStep('error');
    }
  }, [registrationId]);

  // Step 2: Complete check-in with shopping preference
  const handleCompleteCheckIn = async (wantsCoupon: boolean) => {
    if (!verifiedData) return;
    
    setStep('checking-in');
    
    try {
      const result = await completeCheckIn(verifiedData.registrationId, wantsCoupon);
      
      if (!result.success) {
        setError(result.error || "Check-in failed");
        setStep('error');
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
        setStep('complete');
      }
    } catch {
      setError("An unexpected error occurred");
      setStep('error');
    }
  };

  useEffect(() => {
    if (registrationId) {
      handleVerify();
    } else {
      setError("Invalid QR code. Registration ID is missing.");
      setStep('error');
    }
  }, [registrationId, handleVerify]);

  // Loading state
  if (step === 'loading' || step === 'checking-in') {
    return (
      <div className="min-h-screen bg-linear-to-br from-teal-50 via-white to-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center space-y-6">
          <div className="relative">
            <div className="h-20 w-20 mx-auto bg-teal-100 rounded-full flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-teal-600 animate-spin" />
            </div>
            <div className="absolute -top-2 -right-2 h-6 w-6 bg-amber-400 rounded-full animate-bounce" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {step === 'checking-in' ? "Completing Check-In..." : "Verifying Registration..."}
            </h2>
            <p className="text-slate-500 mt-2">
              {step === 'checking-in' ? "Almost there!" : "Hold tight! We're verifying your registration."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-linear-to-br from-red-50 via-white to-rose-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center space-y-6">
          <div className="h-20 w-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Oops!</h2>
            <p className="text-red-600 mt-2">{error}</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={handleVerify}
              className="w-full bg-slate-900 text-white py-3.5 px-6 rounded-xl font-bold hover:bg-slate-800 transition-all"
            >
              Try Again
            </button>
            <p className="text-sm text-slate-500">
              Need help? Visit the registration desk.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Shopping interest prompt (verified state)
  if (step === 'verified' && verifiedData) {
    return (
      <div className="min-h-screen bg-linear-to-br from-teal-50 via-white to-amber-50 flex items-center justify-center p-4">
        {/* Decorative Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 -mr-32 -mt-32 h-96 w-96 rounded-full bg-teal-200 blur-3xl opacity-30" />
          <div className="absolute bottom-0 left-0 -ml-32 -mb-32 h-96 w-96 rounded-full bg-amber-200 blur-3xl opacity-30" />
        </div>

        <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full">
          {/* Header */}
          <div className="bg-linear-to-r from-teal-600 to-teal-700 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="hearts-verify" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M20 10 C17 4 10 4 7 10 C4 16 10 22 20 32 C30 22 36 16 33 10 C30 4 23 4 20 10" fill="currentColor" opacity="0.3"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hearts-verify)" />
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
                  <h3 className="font-bold text-slate-900">Shopping Experience</h3>
                  <p className="text-sm text-slate-600">Would you like a coupon for our vendors?</p>
                </div>
              </div>
              
              <p className="text-sm text-slate-600 mb-4">
                We have amazing vendors at the event! If you&apos;re interested in shopping, 
                we&apos;ll give you a special coupon code you can use.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
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

          {/* Bottom Brand */}
          <div className="bg-slate-50 px-6 py-4 text-center">
            <p className="text-xs text-slate-400 font-medium">
              Powered by RCF ICT Portal • FUTA
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Complete - show success
  if (step === 'complete' && checkedInData) {
    return (
      <div className="min-h-screen bg-linear-to-br from-teal-50 via-white to-amber-50 flex items-center justify-center p-4">
        {/* Decorative Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 -mr-32 -mt-32 h-96 w-96 rounded-full bg-teal-200 blur-3xl opacity-30" />
          <div className="absolute bottom-0 left-0 -ml-32 -mb-32 h-96 w-96 rounded-full bg-amber-200 blur-3xl opacity-30" />
        </div>

        <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full">
          {/* Header */}
          <div className="bg-linear-to-r from-teal-600 to-teal-700 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="hearts-complete" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M20 10 C17 4 10 4 7 10 C4 16 10 22 20 32 C30 22 36 16 33 10 C30 4 23 4 20 10" fill="currentColor" opacity="0.3"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hearts-complete)" />
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

            {/* Coupon Card - Only if they wanted one */}
            {checkedInData.wantsCoupon && checkedInData.couponCode && (
              <div className="bg-linear-to-r from-amber-50 to-amber-100 rounded-2xl p-5 border-2 border-dashed border-amber-300">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 bg-amber-400 rounded-xl flex items-center justify-center shrink-0">
                    <Gift className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 mb-1">Your Shopping Coupon</h3>
                    
                    {checkedInData.hasUsedCoupon ? (
                      <div className="bg-slate-100 rounded-lg p-3 text-center">
                        <p className="font-mono font-bold text-lg text-slate-400 line-through">
                          {checkedInData.couponCode.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">✓ Already Redeemed</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Coupon Code</p>
                          <p className="font-mono font-bold text-xl text-teal-700 tracking-wider break-all">
                            {checkedInData.couponCode.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                        <p className="text-xs text-amber-700 mt-3 text-center font-medium">
                          🛍️ Show this to a vendor to claim your free items!
                        </p>
                      </>
                    )}
                  </div>
                </div>
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
                <p className="text-sm font-bold text-slate-900">Southgate</p>
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
                May you find divine love and meaningful connections.
              </p>
            </div>
          </div>

          {/* Bottom Brand */}
          <div className="bg-slate-50 px-6 py-4 text-center">
            <p className="text-xs text-slate-400 font-medium">
              Powered by RCF ICT Portal • FUTA
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
        <Heart className="h-16 w-16 text-teal-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Check-In</h2>
        <p className="text-slate-500">Scan your Gate Pass QR code to check in.</p>
      </div>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-linear-to-br from-teal-50 via-white to-amber-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-teal-600 animate-spin" />
      </div>
    }>
      <CheckInContent />
    </Suspense>
  );
}
