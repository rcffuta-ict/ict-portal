"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfileStore } from "@/lib/stores/profile.store";
import {
  getEventDetails,
  registerAgapeAction,
  checkExistingRegistration,
} from "./actions";
import {
  Heart,
  User,
  Phone,
  Mail,
  GraduationCap,
  Users,
  Sparkles,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  QrCode,
  MessageSquare,
  UserCheck,
  BookOpen,
  ExternalLink,
  X,
  LogIn,
  Info,
} from "lucide-react";
import Link from "next/link";

type RegistrationStep = "form" | "success" | "already-registered";

interface EventDetails {
  id: string;
  name: string;
  description: string;
  event_date: string;
  venue: string;
  registration_open: boolean;
}

interface ExistingRegistration {
  first_name: string;
  last_name: string;
  email: string;
  checked_in_at: string | null;
  coupon_code: string | null;
}

export default function SinglesWeekendRegistration() {
  const { user } = useProfileStore();
  const isAuthenticated = !!user;
  const profile = user?.profile;

  const [step, setStep] = useState<RegistrationStep>("form");
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [existingReg, setExistingReg] = useState<ExistingRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginBanner, setShowLoginBanner] = useState(true);

  // Toast system
  type Toast = { id: number; type: "success" | "error" | "info"; msg: string };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);

  const showToast = (type: Toast["type"], msg: string, timeout = 4500) => {
    const id = toastId.current++;
    setToasts((t) => [...t, { id, type, msg }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, timeout);
  };

  const dismissToast = (id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  };

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    level: "",
    relationshipStatus: "",
    referralSource: "",
    questions: "",
    isRcfMember: !!user?.profile,
  });

  useEffect(() => {
    const init = async () => {
      try {
        const eventData = await getEventDetails();
        if (eventData) {
          setEvent(eventData);
        }

        if (isAuthenticated && profile) {
          setFormData((prev) => ({
              ...prev,
              firstName: profile.firstName || "",
              lastName: profile.lastName || "",
              email: profile.email || "",
              phone: profile.phoneNumber || "",
              level: user?.academics?.currentLevel || "",
              gender: profile.gender || "",
              isRcfMember: !!profile.firstName,
          }));

          if (profile.email) {
            const existing = await checkExistingRegistration(
              profile.email,
              profile.phoneNumber
            );
            if (existing.exists && existing.registration) {
              setExistingReg({
                first_name: existing.registration.first_name,
                last_name: existing.registration.last_name,
                email: existing.registration.email || profile.email,
                checked_in_at: existing.registration.checked_in_at,
                coupon_code: existing.registration.coupon_code || null,
              });
              setStep("already-registered");
            }
          }
        }
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [isAuthenticated, profile, user?.academics?.currentLevel]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    showToast("info", "Submitting your registration...");

    try {
      const existing = await checkExistingRegistration(formData.email, formData.phone);
      if (existing.exists && existing.registration) {
        setExistingReg({
          first_name: existing.registration.first_name,
          last_name: existing.registration.last_name,
          email: existing.registration.email || formData.email,
          checked_in_at: existing.registration.checked_in_at,
          coupon_code: existing.registration.coupon_code || null,
        });
        setStep("already-registered");
        showToast("info", "You're already registered for this event!");
        setSubmitting(false);
        return;
      }

      const result = await registerAgapeAction({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone_number: formData.phone,
        gender: formData.gender,
        level: formData.level,
        relationship_status: formData.relationshipStatus,
        referral_source: formData.referralSource,
        questions_content: formData.questions,
        is_rcf_member: formData.isRcfMember,
      });

      if (result.success && result.data) {
        setExistingReg({
          first_name: result.data.first_name,
          last_name: result.data.last_name,
          email: result.data.email,
          checked_in_at: null,
          coupon_code: result.data.coupon_code,
        });
        setStep("success");
        showToast("success", "🎉 Registration successful! Welcome to Agape '26!");
      } else if (result.alreadyRegistered && result.registration) {
        setExistingReg({
          first_name: result.registration.first_name,
          last_name: result.registration.last_name,
          email: formData.email,
          checked_in_at: result.registration.checked_in_at,
          coupon_code: result.registration.coupon_code || null,
        });
        setStep("already-registered");
        showToast("info", "You're already registered for this event!");
      } else {
        setError(result.error || "Registration failed. Please try again.");
        showToast("error", result.error || "Registration failed. Please try again.");
      }
    } catch (err) {
      console.error("Submit error:", err);
      setError("An unexpected error occurred. Please try again.");
      showToast("error", "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-teal-900 via-teal-800 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white text-center"
        >
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" />
          <p className="text-teal-200">Loading...</p>
        </motion.div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
          {/* Left Panel - Hero */}
          <div className="lg:w-1/2 lg:fixed lg:inset-y-0 lg:left-0 bg-linear-to-br from-teal-600 via-teal-700 to-slate-800 p-8 lg:p-12 flex flex-col justify-between overflow-hidden">
              {/* Pattern Overlay */}
              <div className="absolute inset-0 opacity-10">
                  <svg
                      className="w-full h-full"
                      xmlns="http://www.w3.org/2000/svg"
                  >
                      <defs>
                          <pattern
                              id="hearts"
                              x="0"
                              y="0"
                              width="40"
                              height="40"
                              patternUnits="userSpaceOnUse"
                          >
                              <path
                                  d="M20 10 Q25 5 30 10 Q35 15 20 25 Q5 15 10 10 Q15 5 20 10"
                                  fill="currentColor"
                              />
                          </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#hearts)" />
                  </svg>
              </div>

              <div className="relative z-10">
                  <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6 }}
                  >
                      <div className="flex items-center gap-3 mb-6">
                          <div className="w-12 h-12 bg-amber-400/20 rounded-xl flex items-center justify-center">
                              <Heart className="w-6 h-6 text-amber-400" />
                          </div>
                          <span className="text-amber-300 font-medium">
                              RCF FUTA Singles Weekend&apos;26
                          </span>
                      </div>

                      <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
                          Agape:{" "}
                          <span className="text-amber-400">Unfailing Love.</span>
                      </h1>

                      <p className="text-teal-100 text-lg max-w-md mb-8">
                          A weekend designed for singles (the unmarried) to learn and grow in love,
                          purpose, and community. Join us for an unforgettable
                          experience.
                      </p>
                  </motion.div>

                  {event && (
                      <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                          className="space-y-4"
                      >
                          <div className="flex items-center gap-3 text-teal-100">
                              <Calendar className="w-5 h-5 text-amber-400" />
                              <span>February 14 - 15, 2026</span>
                          </div>
                          <div className="flex items-center gap-3 text-teal-100">
                              <MapPin className="w-5 h-5 text-amber-400" />
                              <span>RCF FUTA, Southgate Auditorium</span>
                          </div>
                          <div className="flex items-center gap-3 text-teal-100">
                              <Clock className="w-5 h-5 text-amber-400" />
                              <span className="flex items-center gap-2">
                                  <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                                  </span>
                                  Registration is Live!
                              </span>
                          </div>
                      </motion.div>
                  )}

                  {/* Documentation Link */}
                  <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                      className="mt-8"
                  >
                      <Link
                          href="/events/singles-weekend-26/docs"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-teal-100 text-sm transition-colors"
                      >
                          <BookOpen className="w-4 h-4" />
                          View Event Documentation
                          <ExternalLink className="w-3 h-3" />
                      </Link>
                  </motion.div>
              </div>

              <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="relative z-10 hidden lg:block"
              >
                  <div className="flex items-center gap-4">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <p className="text-teal-200 text-sm">
                          &quot;Above all, clothe yourselves with love&quot; -
                          Colossians 3:14
                      </p>
                  </div>
              </motion.div>
          </div>

          {/* Right Panel - Form/Success */}
          <div className="lg:w-1/2 lg:ml-[50%] min-h-screen">
              <AnimatePresence mode="wait">
                  {step === "form" && (
                      <motion.div
                          key="form"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="p-8 lg:p-12 max-w-xl mx-auto"
                      >
                          <h2 className="text-2xl font-bold text-slate-800 mb-2">
                              Register Now
                          </h2>
                          <p className="text-slate-600 mb-6">
                              Fill in your details to secure your spot at Agape
                              2026.
                              {isAuthenticated && (
                                  <span className="block text-teal-600 text-sm mt-1">
                                      <UserCheck className="w-4 h-4 inline mr-1" />
                                      Some fields pre-filled from your profile
                                  </span>
                              )}
                          </p>

                          {/* Login suggestion banner for unauthenticated users */}
                          {!isAuthenticated && showLoginBanner && (
                              <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl"
                              >
                                  <div className="flex items-start gap-3">
                                      <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                          <p className="text-blue-800 text-sm font-medium">
                                              RCF Member?
                                          </p>
                                          <p className="text-blue-700 text-xs mt-1">
                                              If you have an RCF portal account,
                                              you can{" "}
                                              <Link
                                                  href="/login"
                                                  className="underline font-medium hover:text-blue-900"
                                              >
                                                  login first
                                              </Link>{" "}
                                              to auto-fill your details.
                                              Otherwise, continue as a guest
                                              below.
                                          </p>
                                      </div>
                                      <button
                                          type="button"
                                          onClick={() =>
                                              setShowLoginBanner(false)
                                          }
                                          className="p-1 hover:bg-blue-100 rounded-lg transition-colors"
                                      >
                                          <X className="w-4 h-4 text-blue-500" />
                                      </button>
                                  </div>
                                  <div className="mt-3 flex gap-2">
                                      <Link
                                          href="/login"
                                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                      >
                                          <LogIn className="w-4 h-4" />
                                          Login to Portal
                                      </Link>
                                      <button
                                          type="button"
                                          onClick={() =>
                                              setShowLoginBanner(false)
                                          }
                                          className="flex-1 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm font-medium rounded-lg transition-colors"
                                      >
                                          Continue as Guest
                                      </button>
                                  </div>
                              </motion.div>
                          )}

                          {error && (
                              <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
                              >
                                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                  <p className="text-red-700 text-sm">
                                      {error}
                                  </p>
                              </motion.div>
                          )}

                          <form onSubmit={handleSubmit} className="space-y-5">
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                          First Name
                                      </label>
                                      <div className="relative">
                                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                          <input
                                              type="text"
                                              name="firstName"
                                              value={formData.firstName}
                                              onChange={handleInputChange}
                                              disabled={
                                                  isAuthenticated &&
                                                  !!profile?.firstName
                                              }
                                              required
                                              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                              placeholder="John"
                                          />
                                      </div>
                                  </div>
                                  <div>
                                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                          Last Name
                                      </label>
                                      <input
                                          type="text"
                                          name="lastName"
                                          value={formData.lastName}
                                          onChange={handleInputChange}
                                          disabled={
                                              isAuthenticated &&
                                              !!profile?.lastName
                                          }
                                          required
                                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                          placeholder="Doe"
                                      />
                                  </div>
                              </div>

                              <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                      Email Address
                                  </label>
                                  <div className="relative">
                                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                      <input
                                          type="email"
                                          name="email"
                                          value={formData.email}
                                          onChange={handleInputChange}
                                          disabled={
                                              isAuthenticated &&
                                              !!profile?.email
                                          }
                                          required
                                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                          placeholder="john@example.com"
                                      />
                                  </div>
                              </div>

                              <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                      Phone Number
                                  </label>
                                  <div className="relative">
                                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                      <input
                                          type="tel"
                                          name="phone"
                                          value={formData.phone}
                                          onChange={handleInputChange}
                                          disabled={
                                              isAuthenticated &&
                                              !!profile?.phoneNumber
                                          }
                                          required
                                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                          placeholder="08012345678"
                                      />
                                  </div>
                              </div>

                              <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                      Gender
                                  </label>
                                  <div className="relative">
                                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                      <select
                                          name="gender"
                                          value={formData.gender}
                                          onChange={handleInputChange}
                                          disabled={
                                              isAuthenticated &&
                                              !!profile?.gender
                                          }
                                          required
                                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all appearance-none disabled:bg-slate-50 disabled:text-slate-500"
                                      >
                                          <option value="">
                                              Select gender
                                          </option>
                                          <option value="male">Brother</option>
                                          <option value="female">Sister</option>
                                      </select>
                                  </div>
                              </div>

                              <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                      Level
                                  </label>
                                  <div className="relative">
                                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                      <select
                                          name="level"
                                          value={formData.level}
                                          onChange={handleInputChange}
                                          required
                                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all appearance-none"
                                      >
                                          <option value="">Select level</option>
                                          <option value="100">100 Level</option>
                                          <option value="200">200 Level</option>
                                          <option value="300">300 Level</option>
                                          <option value="400">400 Level</option>
                                          <option value="500">500 Level</option>
                                          <option value="guest">Guest</option>
                                          <option value="postgrad">
                                              Postgraduate
                                          </option>
                                          <option value="alumni">Alumni</option>
                                      </select>
                                  </div>
                              </div>

                              <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                      Relationship Status
                                  </label>
                                  <div className="relative">
                                      <Heart className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                      <select
                                          name="relationshipStatus"
                                          value={formData.relationshipStatus}
                                          onChange={handleInputChange}
                                          required
                                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all appearance-none"
                                      >
                                          <option value="">
                                              Select status
                                          </option>
                                          <option value="single">Single</option>
                                          <option value="in_relationship">
                                              In a Relationship
                                          </option>
                                          <option value="engaged">
                                              Engaged
                                          </option>
                                          <option value="complicated">
                                              You can&apos;t exactly tell yet
                                          </option>
                                      </select>
                                  </div>
                                  <p className="text-sm text-slate-500 block italic font-semibold">
                                      Don&apos;t worry, we&apos;ll keep it
                                      confidential for you
                                  </p>
                              </div>

                              <div className="flex items-center justify-between p-4 bg-teal-50 rounded-xl border border-teal-100">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                          <Users className="w-5 h-5 text-teal-600" />
                                      </div>
                                      <div>
                                          <p className="font-medium text-slate-800">
                                              RCF FUTA Member
                                          </p>
                                          <p className="text-sm text-slate-500">
                                              Are you a member of RCF FUTA?
                                          </p>
                                      </div>
                                  </div>
                                  <button
                                      type="button"
                                      onClick={() =>
                                          setFormData((prev) => ({
                                              ...prev,
                                              isRcfMember: !prev.isRcfMember,
                                          }))
                                      }
                                      className={`relative w-12 h-6 rounded-full transition-colors ${formData.isRcfMember ? "bg-teal-500" : "bg-slate-300"}`}
                                  >
                                      <span
                                          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isRcfMember ? "translate-x-6" : ""}`}
                                      />
                                  </button>
                              </div>

                              <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                      How did you hear about this event?
                                  </label>
                                  <select
                                      name="referralSource"
                                      value={formData.referralSource}
                                      onChange={handleInputChange}
                                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all appearance-none"
                                  >
                                      <option value="">
                                          Select source (optional)
                                      </option>
                                      <option value="rcf_service">
                                          RCF Service
                                      </option>
                                      <option value="social_media">
                                          Social Media
                                      </option>
                                      <option value="friend">Friend</option>
                                      <option value="flyer">
                                          Flyer/Poster
                                      </option>
                                      <option value="other">Other</option>
                                  </select>
                              </div>

                              <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                      <MessageSquare className="w-4 h-4 inline mr-1" />
                                      Any questions for the speakers? (Optional)
                                  </label>
                                  <textarea
                                      name="questions"
                                      value={formData.questions}
                                      onChange={handleInputChange}
                                      rows={3}
                                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                                      placeholder="Write any questions you'd like addressed..."
                                  />
                              </div>

                              <button
                                  type="submit"
                                  disabled={submitting}
                                  className="w-full py-4 bg-linear-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold rounded-xl shadow-lg shadow-teal-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                              >
                                  {submitting ? (
                                      <>
                                          <Loader2 className="w-5 h-5 animate-spin" />
                                          Registering...
                                      </>
                                  ) : (
                                      <>
                                          Complete Registration
                                          <ArrowRight className="w-5 h-5" />
                                      </>
                                  )}
                              </button>
                          </form>
                      </motion.div>
                  )}

                  {step === "success" && existingReg && (
                      <motion.div
                          key="success"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-8 lg:p-12 max-w-xl mx-auto"
                      >
                          <div className="text-center mb-8">
                              <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", delay: 0.2 }}
                                  className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                              >
                                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                              </motion.div>
                              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                                  Registration Successful!
                              </h2>
                              <p className="text-slate-600">
                                  Welcome to Agape 2026,{" "}
                                  {existingReg.first_name}!
                              </p>
                          </div>

                          {/* Confirmation Card */}
                          <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 }}
                              className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 mb-8"
                          >
                              <div className="bg-linear-to-r from-teal-600 to-teal-700 p-6 text-white">
                                  <div className="flex items-center justify-between">
                                      <div>
                                          <p className="text-teal-200 text-sm">
                                              Agape 2026
                                          </p>
                                          <p className="text-xl font-bold">
                                              {existingReg.first_name}{" "}
                                              {existingReg.last_name}
                                          </p>
                                      </div>
                                      <Heart className="w-8 h-8 text-amber-400" />
                                  </div>
                              </div>

                              <div className="p-6 text-center">
                                  <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                      <UserCheck className="w-8 h-8 text-teal-600" />
                                  </div>
                                  <h3 className="font-bold text-slate-800 mb-2">
                                      You&apos;re All Set!
                                  </h3>
                                  <p className="text-slate-600 text-sm">
                                      Your registration is confirmed. See you at
                                      the event!
                                  </p>
                              </div>
                          </motion.div>

                          {/* Self Check-In Instructions */}
                          <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.4 }}
                              className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6"
                          >
                              <h3 className="font-semibold text-amber-800 mb-4 flex items-center gap-2">
                                  <QrCode className="w-5 h-5" />
                                  How to Check In at the Event
                              </h3>
                              <ol className="space-y-3 text-amber-900 text-sm">
                                  <li className="flex items-start gap-2">
                                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                                          1
                                      </span>
                                      <span>
                                          Arrive at{" "}
                                          <strong>
                                              RCF FUTA, Southgate Auditorium
                                          </strong>{" "}
                                          on <strong>Feb 14-15, 2026</strong>
                                      </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                                          2
                                      </span>
                                      <span>
                                          Look for the{" "}
                                          <strong>Check-In QR Code</strong>{" "}
                                          posters at the entrance
                                      </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                                          3
                                      </span>
                                      <span>
                                          Scan the QR code with your phone
                                          camera
                                      </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                                          4
                                      </span>
                                      <span>
                                          Enter your phone number (
                                          <strong>{existingReg.email}</strong>)
                                          to check yourself in
                                      </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                                          5
                                      </span>
                                      <span>
                                          Choose if you want a shopping coupon
                                          for our vendors!
                                      </span>
                                  </li>
                              </ol>
                          </motion.div>

                          {/* Event Details */}
                          <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.5 }}
                              className="grid grid-cols-2 gap-3 mb-6"
                          >
                              <div className="bg-teal-50 rounded-xl p-4 text-center">
                                  <Calendar className="w-5 h-5 text-teal-600 mx-auto mb-2" />
                                  <p className="text-xs text-slate-500">Date</p>
                                  <p className="text-sm font-bold text-slate-900">
                                      Feb 14-15, 2026
                                  </p>
                              </div>
                              <div className="bg-teal-50 rounded-xl p-4 text-center">
                                  <MapPin className="w-5 h-5 text-teal-600 mx-auto mb-2" />
                                  <p className="text-xs text-slate-500">
                                      Venue
                                  </p>
                                  <p className="text-sm font-bold text-slate-900">
                                      RCF FUTA, Southgate
                                  </p>
                              </div>
                          </motion.div>

                          {/* Documentation Link */}
                          <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.6 }}
                              className="mb-6"
                          >
                              <Link
                                  href="/events/singles-weekend-26/docs"
                                  className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-sm font-medium transition-colors"
                              >
                                  <BookOpen className="w-4 h-4" />
                                  View Event Documentation
                              </Link>
                          </motion.div>

                          <p className="text-center text-slate-500 text-sm">
                              📱 Remember your registered phone/email to check
                              in at the event.
                          </p>
                      </motion.div>
                  )}

                  {step === "already-registered" && existingReg && (
                      <motion.div
                          key="already"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-8 lg:p-12 max-w-xl mx-auto"
                      >
                          <div className="text-center mb-8">
                              <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", delay: 0.2 }}
                                  className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6"
                              >
                                  <UserCheck className="w-10 h-10 text-teal-600" />
                              </motion.div>
                              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                                  Already Registered!
                              </h2>
                              <p className="text-slate-600">
                                  Hey {existingReg.first_name}, you&apos;ve
                                  already registered for Agape 2026.
                              </p>
                              {existingReg.checked_in_at && (
                                  <p className="text-green-600 mt-2 flex items-center justify-center gap-1">
                                      <CheckCircle2 className="w-4 h-4" />
                                      Checked in on{" "}
                                      {new Date(
                                          existingReg.checked_in_at,
                                      ).toLocaleDateString()}
                                  </p>
                              )}
                          </div>

                          {/* Confirmation Card */}
                          <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 }}
                              className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 mb-8"
                          >
                              <div className="bg-linear-to-r from-teal-600 to-teal-700 p-6 text-white">
                                  <div className="flex items-center justify-between">
                                      <div>
                                          <p className="text-teal-200 text-sm">
                                              Agape 2026
                                          </p>
                                          <p className="text-xl font-bold">
                                              {existingReg.first_name}{" "}
                                              {existingReg.last_name}
                                          </p>
                                      </div>
                                      <Heart className="w-8 h-8 text-amber-400" />
                                  </div>
                              </div>

                              <div className="p-6 text-center">
                                  <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                      <UserCheck className="w-8 h-8 text-teal-600" />
                                  </div>
                                  <h3 className="font-bold text-slate-800 mb-2">
                                      You&apos;re All Set!
                                  </h3>
                                  <p className="text-slate-600 text-sm">
                                      Your registration is confirmed. See you at
                                      the event!
                                  </p>
                              </div>
                          </motion.div>

                          {/* Self Check-In Instructions */}
                          <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.4 }}
                              className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6"
                          >
                              <h3 className="font-semibold text-amber-800 mb-4 flex items-center gap-2">
                                  <QrCode className="w-5 h-5" />
                                  How to Check In at the Event
                              </h3>
                              <ol className="space-y-3 text-amber-900 text-sm">
                                  <li className="flex items-start gap-2">
                                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                                          1
                                      </span>
                                      <span>
                                          Arrive at{" "}
                                          <strong>
                                              RCF FUTA, Southgate Auditorium
                                          </strong>{" "}
                                          on <strong>Feb 14-15, 2026</strong>
                                      </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                                          2
                                      </span>
                                      <span>
                                          Look for the{" "}
                                          <strong>Check-In QR Code</strong>{" "}
                                          posters at the entrance
                                      </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                                          3
                                      </span>
                                      <span>
                                          Scan the QR code with your phone
                                          camera
                                      </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                                          4
                                      </span>
                                      <span>
                                          Enter your phone number or email to
                                          check yourself in
                                      </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                                          5
                                      </span>
                                      <span>
                                          Choose if you want a shopping coupon
                                          for our vendors!
                                      </span>
                                  </li>
                              </ol>
                          </motion.div>

                          {/* Documentation Link */}
                          <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.5 }}
                          >
                              <Link
                                  href="/events/singles-weekend-26/docs"
                                  className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-sm font-medium transition-colors"
                              >
                                  <BookOpen className="w-4 h-4" />
                                  View Event Documentation
                              </Link>
                          </motion.div>
                      </motion.div>
                  )}
              </AnimatePresence>
          </div>

          {/* Toast Container */}
          <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
              <AnimatePresence>
                  {toasts.map((t) => (
                      <motion.div
                          key={t.id}
                          initial={{ opacity: 0, y: -20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-sm ${
                              t.type === "success"
                                  ? "bg-green-50/95 border-green-200 text-green-800"
                                  : t.type === "error"
                                    ? "bg-red-50/95 border-red-200 text-red-800"
                                    : "bg-blue-50/95 border-blue-200 text-blue-800"
                          }`}
                      >
                          {t.type === "success" && (
                              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          )}
                          {t.type === "error" && (
                              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                          )}
                          {t.type === "info" && (
                              <Info className="w-5 h-5 text-blue-500 shrink-0" />
                          )}
                          <p className="text-sm flex-1">{t.msg}</p>
                          <button
                              onClick={() => dismissToast(t.id)}
                              className="p-1 hover:bg-black/5 rounded-lg transition-colors"
                          >
                              <X className="w-4 h-4" />
                          </button>
                      </motion.div>
                  ))}
              </AnimatePresence>
          </div>
      </div>
  );
}
