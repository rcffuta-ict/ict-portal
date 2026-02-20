"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Users,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  ArrowLeft,
  X,
  LogIn,
  Info,
  BookOpen,
  Sparkles,
  School,
  IdCard,
  Building,
  ClipboardList
} from "lucide-react";
import Link from "next/link";
import { useProfileStore } from "@/lib/stores/profile.store";
import { getEventBySlug, registerForEvent } from "../../actions";
import { CompactPreloader } from "@/components/ui/preloader";

type RegistrationStep = "form" | "success";

export default function GenericEventRegistration() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const user = useProfileStore(e=>e.user);
  const isAuthenticated = !!user;

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<RegistrationStep>("form");
  const [showLoginBanner, setShowLoginBanner] = useState(true);

  const [formData, setFormData] = useState<Record<string, string>>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    level: "",
    department: "",
    matricNumber: "",
  });

  const regConfig = useMemo(() => {
    return event?.config?.registration || { enabled: false, fields: [] };
  }, [event]);

  useEffect(() => {
    const init = async () => {
      try {
        const result = await getEventBySlug(slug);
        if (result.success) {
          const eventData = result.data;
          if (!eventData.config?.registration?.enabled) {
            setError("Registration is not available for this event.");
          }
          setEvent(eventData);

          // Pre-fill if authenticated
          if (isAuthenticated && user?.profile) {
            setFormData({
              firstName: user.profile.firstName || "",
              lastName: user.profile.lastName || "",
              email: user.profile.email || "",
              phone: user.profile.phoneNumber || "",
              gender: user.profile.gender || "",
              level: user.academics?.currentLevel || "",
              department: user.academics.department || "",
              matricNumber: user.academics.matricNumber || "",
            });
          }
        } else {
          setError(result.error || "Event not found");
        }
      } catch (err) {
        setError("Failed to initialize registration page");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [slug, isAuthenticated, user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await registerForEvent({
        event_id: event.id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone_number: formData.phone,
        gender: formData.gender,
        level: formData.level,
        department: formData.department,
        matric_number: formData.matricNumber,
        is_rcf_member: isAuthenticated || !!user,
      });

      if (result.success) {
        setStep("success");
      } else {
        setError(result.error || "Registration failed");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <CompactPreloader title="Loading Registration..." />;

  if (error && !event) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-4xl p-12 text-center shadow-xl">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-slate-900 mb-4">Registration Unavailable</h1>
          <p className="text-slate-500 mb-8">{error}</p>
          <button onClick={() => router.back()} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold">Go Back</button>
        </div>
      </div>
    );
  }

  const isFieldRequired = (fieldName: string) => {
    return regConfig.fields?.includes(fieldName);
  };

  const availableLevels = [];
  if (regConfig.allowStudents) {
    availableLevels.push("100L", "200L", "300L", "400L", "500L", "Postgraduate");
  }
  if (regConfig.allowAlumni) availableLevels.push("Alumni");
  if (regConfig.allowGuest) availableLevels.push("Guest");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Panel - Event Summary */}
      <div className="lg:w-1/3 lg:fixed lg:inset-y-0 lg:left-0 bg-slate-900 p-8 lg:p-12 flex flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px'}} />

        <div className="relative z-10">
          <Link href={`/events/${slug}`} className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-12 font-bold group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Details
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <span className="text-blue-400 font-black uppercase tracking-widest text-xs">Event Registration</span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-black text-white mb-6 leading-tight">
            {event?.title}
          </h1>

          <p className="text-slate-400 text-lg mb-8 leading-relaxed italic">
            &ldquo;{event?.description?.slice(0, 150)}{event?.description?.length > 150 ? '...' : ''}&rdquo;
          </p>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 text-slate-400">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <p className="text-sm font-medium italic opacity-60">Join the gathering of the saints.</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="lg:w-2/3 lg:ml-[33.33%] min-h-screen">
        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="p-8 lg:p-16 max-w-2xl mx-auto">
              <div className="mb-10">
                <h2 className="text-3xl font-black text-slate-900 mb-2">Registration Form</h2>
                <p className="text-slate-500 font-medium">Please provide the necessary details below to secure your attendance.</p>
              </div>

              {!isAuthenticated && showLoginBanner && (
                <div className="mb-8 p-6 bg-blue-50 border border-blue-100 rounded-3xl flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                    <LogIn className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-blue-900 font-bold mb-1">Already have an account?</p>
                    <p className="text-blue-700 text-sm mb-4">Login to automatically fill the form with your profile data.</p>
                    <div className="flex gap-3">
                      <Link href="/login" className="px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase rounded-xl">Login</Link>
                      <button onClick={() => setShowLoginBanner(false)} className="px-4 py-2 text-blue-600 text-xs font-black uppercase">Dismiss</button>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4">
                  <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
                  <p className="text-red-700 text-sm font-bold">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {isFieldRequired("firstName") && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">First Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} required className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="Enter first name" />
                      </div>
                    </div>
                  )}

                  {isFieldRequired("lastName") && (
                    <div className="space-y-2">
                       <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Last Name</label>
                       <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} required className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="Enter last name" />
                    </div>
                  )}

                  {isFieldRequired("email") && (
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="yourname@example.com" />
                      </div>
                    </div>
                  )}

                  {isFieldRequired("phone") && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="080..." />
                      </div>
                    </div>
                  )}

                  {isFieldRequired("gender") && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Gender</label>
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        <select name="gender" value={formData.gender} onChange={handleInputChange} required className="w-full pl-12 pr-10 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold appearance-none">
                          <option value="">Select gender</option>
                          <option value="male">Brother</option>
                          <option value="female">Sister</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {isFieldRequired("level") && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Current Status</label>
                      <div className="relative">
                        <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        <select name="level" value={formData.level} onChange={handleInputChange} required className="w-full pl-12 pr-10 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold appearance-none">
                          <option value="">Select status</option>
                          {availableLevels.map(lvl => (
                            <option key={lvl} value={lvl}>{lvl}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {isFieldRequired("department") && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Department</label>
                      <div className="relative">
                        <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        <input type="text" name="department" value={formData.department} onChange={handleInputChange} className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="Computer Science..." />
                      </div>
                    </div>
                  )}

                  {isFieldRequired("matricNumber") && (
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Matric Number</label>
                      <div className="relative">
                        <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        <input type="text" name="matricNumber" value={formData.matricNumber} onChange={handleInputChange} className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" placeholder="12/3456" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-6">
                  <button type="submit" disabled={submitting} className="w-full py-5 bg-slate-900 hover:bg-blue-600 text-white font-black uppercase tracking-widest rounded-3xl transition-all flex items-center justify-center gap-3 shadow-2xl shadow-slate-900/10 disabled:opacity-50 group">
                    {submitting ? (
                      <><Loader2 className="w-6 h-6 animate-spin" /> Processing...</>
                    ) : (
                      <>Complete Registration <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" /></>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 lg:p-16 max-w-xl mx-auto flex flex-col items-center justify-center min-h-screen text-center">
              <div className="w-24 h-24 bg-green-100 rounded-4xl flex items-center justify-center mb-8">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-4">You&apos;re Registered!</h2>
              <p className="text-slate-500 text-lg mb-10 font-medium leading-relaxed">Your registration for <strong>{event?.title}</strong> was successful. We look forward to seeing you there!</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                <Link href={`/events/${slug}`} className="px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-colors">Event Details</Link>
                <Link href="/events" className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-colors">Back to Events</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
