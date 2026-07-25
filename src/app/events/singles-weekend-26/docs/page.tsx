"use client";

import { SinglesWeekendFooter } from "@/components/events/footer";
import { motion } from "framer-motion";
import {
  Heart,
  UserCheck,
  ShoppingBag,
  QrCode,
  Gift,
  CheckCircle2,
  ArrowRight,
  Smartphone,
  Users,
  AlertCircle,
  Scan,
  XCircle,
  Phone,
  Mail,
  Download,
  BookOpen,
} from "lucide-react";
import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-linear-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                  <Heart className="h-6 w-6 text-white fill-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Agape &apos;26</h1>
                <p className="text-sm text-slate-500">Event Documentation</p>
              </div>
            </div>

          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Hero */}
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-linear-to-br from-teal-500 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-teal-500/20">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Singles Weekend 2026
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Complete guide to the check-in process, shopping coupons, and event management
            </p>
            <div className="flex items-center justify-center gap-4 mt-6 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Heart className="w-4 h-4 text-teal-600 fill-teal-600" />
                Agape &apos;26
              </span>
              <span>•</span>
              <span>Feb 14-15, 2026</span>
              <span>•</span>
              <span>Southgate Auditorium</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid md:grid-cols-2 gap-4">

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Admin Access</h3>
              <p className="text-sm text-slate-500">For admin access, please contact the event committee</p>
            </div>
          </div>

          {/* Overview Section */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                <Heart className="w-5 h-5 text-teal-600" />
              </div>
              System Overview
            </h2>
            <p className="text-slate-600 leading-relaxed mb-6">
              The Agape &apos;26 event system handles attendee check-in and a shopping coupon program.
              Here&apos;s how the entire flow works from registration to event day.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-linear-to-br from-teal-50 to-teal-100/50 rounded-xl p-5">
                <h4 className="font-semibold text-teal-900 mb-2">Check-In System</h4>
                <p className="text-sm text-teal-700">
                  Event staff/admins check in attendees using their phone number or email.
                  Attendees are asked if they want a shopping coupon.
                </p>
              </div>
              <div className="bg-linear-to-br from-amber-50 to-amber-100/50 rounded-xl p-5">
                <h4 className="font-semibold text-amber-900 mb-2">Coupon System</h4>
                <p className="text-sm text-amber-700">
                  Coupons are one-time use. Vendors scan or enter the code to validate
                  and invalidate coupons for shopping redemption.
                </p>
              </div>
            </div>
          </section>

          {/* Attendee Check-In Flow */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-teal-600" />
              </div>
              Attendee Check-In Process
            </h2>

            <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Check-in is managed by event committee. Attendees will be checked in by the team at the event entrance.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                  <div className="w-0.5 h-full bg-teal-200 mt-2" />
                </div>
                <div className="pb-8">
                  <h3 className="font-semibold text-slate-900 mb-2">Admin Access Check-In Portal</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    Event staff/admins access the check-in portal (admin dashboard) to manage attendee check-ins.
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <Smartphone className="w-4 h-4 text-slate-400" />
                    <code className="bg-slate-100 px-2 py-1 rounded text-xs">/events/singles-weekend-26/admin</code>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                  <div className="w-0.5 h-full bg-teal-200 mt-2" />
                </div>
                <div className="pb-8">
                  <h3 className="font-semibold text-slate-900 mb-2">Verify Attendee Identity</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    Staff enters the attendee's phone number or email to look up their registration.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs">
                      <Phone className="w-3 h-3" /> Phone Number
                    </span>
                    <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs">
                      <Mail className="w-3 h-3" /> Email Address
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                  <div className="w-0.5 h-full bg-teal-200 mt-2" />
                </div>
                <div className="pb-8">
                  <h3 className="font-semibold text-slate-900 mb-2">Shopping Coupon Choice</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    After verification, the attendee is asked if they want a shopping coupon for the event vendors.
                  </p>
                  <div className="grid grid-cols-2 gap-3 max-w-xs">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                      <Gift className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                      <p className="text-xs font-medium text-amber-800">Yes, I want one!</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                      <XCircle className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs font-medium text-slate-600">No thanks</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Check-In Complete!</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    The attendee is checked in and shown a success screen with their coupon code (if opted in).
                  </p>
                  <div className="bg-linear-to-r from-amber-50 to-amber-100/50 rounded-xl p-4 border border-amber-200 max-w-xs">
                    <p className="text-xs text-slate-500 mb-1">Coupon Code</p>
                    <p className="font-mono font-bold text-lg text-teal-700">AGAPE26-ABC1DEF2</p>
                    <p className="text-xs text-amber-700 mt-2">🛍️ Show this to a vendor!</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Coupon Redemption Flow */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-amber-600" />
              </div>
              Vendor Coupon Redemption
            </h2>

            <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  <strong>Important:</strong> Each coupon can only be used <strong>once</strong>.
                  Once a vendor invalidates a coupon, it cannot be used again.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold">1</div>
                  <div className="w-0.5 h-full bg-amber-200 mt-2" />
                </div>
                <div className="pb-8">
                  <h3 className="font-semibold text-slate-900 mb-2">Vendor Opens Scanner</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    Vendors access the scanner page on their phone or device.
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <Scan className="w-4 h-4 text-slate-400" />
                    <code className="bg-slate-100 px-2 py-1 rounded text-xs">/events/singles-weekend-26/vendor</code>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold">2</div>
                  <div className="w-0.5 h-full bg-amber-200 mt-2" />
                </div>
                <div className="pb-8">
                  <h3 className="font-semibold text-slate-900 mb-2">Scan or Enter Coupon</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    Vendor can either scan the QR code from the attendee&apos;s phone or manually enter the coupon code.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs">
                      <QrCode className="w-3 h-3" /> Scan QR Code
                    </span>
                    <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h12" />
                      </svg>
                      Manual Entry
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold">3</div>
                  <div className="w-0.5 h-full bg-amber-200 mt-2" />
                </div>
                <div className="pb-8">
                  <h3 className="font-semibold text-slate-900 mb-2">Coupon Validation</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    System checks if the coupon is valid and hasn&apos;t been used yet.
                  </p>
                  <div className="grid grid-cols-2 gap-3 max-w-sm">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mb-1" />
                      <p className="text-xs font-medium text-green-800">Valid Coupon</p>
                      <p className="text-xs text-green-600 mt-1">Shows attendee name</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <XCircle className="w-5 h-5 text-red-500 mb-1" />
                      <p className="text-xs font-medium text-red-800">Invalid/Used</p>
                      <p className="text-xs text-red-600 mt-1">Shows error message</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Invalidate Coupon</h3>
                  <p className="text-slate-600 text-sm mb-3">
                    Vendor taps &quot;Invalidate Coupon&quot; to mark it as used. The attendee can then receive their free item(s).
                  </p>
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200 max-w-xs">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Coupon Invalidated!</span>
                    </div>
                    <p className="text-xs text-green-600 mt-2">The coupon is now marked as used and cannot be used again.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Coupon States */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Gift className="w-5 h-5 text-purple-600" />
              </div>
              Coupon States Explained
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">State</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">coupon_code</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">coupon_active</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">coupon_used_at</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium">No Coupon</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">null</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">false</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">null</td>
                    <td className="py-3 px-4 text-slate-600">Attendee opted out of shopping</td>
                  </tr>
                  <tr className="bg-green-50/50">
                    <td className="py-3 px-4">
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">Active</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-green-700">AGAPE26-XXX</td>
                    <td className="py-3 px-4 font-mono text-xs text-green-700">true</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">null</td>
                    <td className="py-3 px-4 text-slate-600">Valid coupon, ready to use</td>
                  </tr>
                  <tr className="bg-amber-50/50">
                    <td className="py-3 px-4">
                      <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium">Used</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-amber-700">AGAPE26-XXX</td>
                    <td className="py-3 px-4 font-mono text-xs text-amber-700">false</td>
                    <td className="py-3 px-4 font-mono text-xs text-amber-700">timestamp</td>
                    <td className="py-3 px-4 text-slate-600">Coupon has been redeemed</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Event Management */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              Event Management
            </h2>

            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    Need Admin Access?
                  </p>
                  <p className="text-sm text-blue-700">
                    If you need access to event management features such as viewing registrations,
                    check-in statistics, or exporting attendee data, please reach out to the event committee.
                    The committee will provide you with the necessary access and guidance.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* FAQs */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              Frequently Asked Questions
            </h2>

            <div className="space-y-4">
              <details className="bg-slate-50 rounded-xl p-4 group">
                <summary className="font-semibold text-slate-900 cursor-pointer list-none flex items-center justify-between">
                  What if an attendee can&apos;t find their registration?
                  <ArrowRight className="w-5 h-5 text-slate-400 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-slate-600 text-sm mt-3">
                  They should try both their phone number and email. The system handles multiple phone formats
                  (08012345678, +2348012345678, etc.). If still not found, please contact the event committee
                  to verify the registration.
                </p>
              </details>

              <details className="bg-slate-50 rounded-xl p-4 group">
                <summary className="font-semibold text-slate-900 cursor-pointer list-none flex items-center justify-between">
                  Can someone check in multiple times?
                  <ArrowRight className="w-5 h-5 text-slate-400 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-slate-600 text-sm mt-3">
                  Yes, but they&apos;ll see a &quot;Welcome Back&quot; screen showing they&apos;re already checked in.
                  Their coupon (if they have one) will still be displayed with its current status.
                </p>
              </details>

              <details className="bg-slate-50 rounded-xl p-4 group">
                <summary className="font-semibold text-slate-900 cursor-pointer list-none flex items-center justify-between">
                  What if a coupon won&apos;t scan?
                  <ArrowRight className="w-5 h-5 text-slate-400 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-slate-600 text-sm mt-3">
                  The vendor can switch to manual entry mode and type in the coupon code directly.
                  The system does case-insensitive matching so AGAPE26-ABC123 and agape26-abc123 both work.
                </p>
              </details>

              <details className="bg-slate-50 rounded-xl p-4 group">
                <summary className="font-semibold text-slate-900 cursor-pointer list-none flex items-center justify-between">
                  Can a coupon be &quot;un-redeemed&quot;?
                  <ArrowRight className="w-5 h-5 text-slate-400 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-slate-600 text-sm mt-3">
                  No, once a coupon is invalidated it cannot be used again. This is by design to prevent
                  fraud. If there&apos;s an error, please contact the event committee for assistance.
                </p>
              </details>

              <details className="bg-slate-50 rounded-xl p-4 group">
                <summary className="font-semibold text-slate-900 cursor-pointer list-none flex items-center justify-between">
                  What does the coupon code format mean?
                  <ArrowRight className="w-5 h-5 text-slate-400 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-slate-600 text-sm mt-3">
                  The format is <code className="bg-white px-1 rounded">AGAPE26-XXXXXXXX</code> where AGAPE26
                  identifies the event and XXXXXXXX is a random 8-character alphanumeric code unique to each attendee.
                </p>
              </details>
            </div>
          </section>

          {/* Footer */}
          <SinglesWeekendFooter/>
        </motion.div>
      </main>
    </div>
  );
}
