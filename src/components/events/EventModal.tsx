"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  Type,
  FileText,
  Check,
  Loader2,
  Save,
  Sparkles,
  Link2,
  Lock,
  Repeat,
  Activity,
  CalendarDays
} from "lucide-react";
import { useForm } from "react-hook-form";
import { createEvent, updateEvent } from "@/app/events/actions";
import { Event } from "@/app/events/page";
import { useProfileStore } from "@/lib/stores/profile.store";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  event?: Event | null; // If provided, we are in edit mode
}

interface EventFormData {
  title: string;
  slug: string;
  description: string;
  date: string;
  is_active: boolean;
  is_recurring: boolean;
  is_exclusive: boolean;
}

export function EventModal({ isOpen, onClose, onSuccess, event }: EventModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useProfileStore(e => e.user);
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!event;

  const { register, handleSubmit, reset, watch, setValue } = useForm<EventFormData>({
    defaultValues: {
      is_active: true,
      is_recurring: false,
      is_exclusive: false,
      date: new Date().toISOString().slice(0, 16),
    }
  });

  // Reset/Populate form when opening
  useEffect(() => {
    if (isOpen) {
      if (event) {
        setValue("title", event.title);
        setValue("slug", event.slug);
        setValue("description", event.description || "");
        // Format date for datetime-local: YYYY-MM-DDThh:mm
        const eDate = event.date ? new Date(event.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16);
        setValue("date", eDate);
        setValue("is_active", event.is_active);
        setValue("is_recurring", !!event.is_recurring);
        setValue("is_exclusive", !!event.is_exclusive);
      } else {
        reset({
          is_active: true,
          is_recurring: false,
          is_exclusive: false,
          date: new Date().toISOString().slice(0, 16),
          title: "",
          slug: "",
          description: ""
        });
      }
    }
  }, [isOpen, event, setValue, reset]);

  const isRecurring = watch("is_recurring");
  const currentTitle = watch("title");

  const onSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        ...data,
        date: new Date(data.date).toISOString(),
      };

      let result;
      if (isEditing && event) {
        result = await updateEvent(event.id, payload);
      } else {
        result = await createEvent(payload, user?.profile.email || "");
      }

      if (result.success) {
        reset();
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || `Failed to ${isEditing ? 'update' : 'create'} event`);
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="relative w-full max-w-2xl bg-white rounded-4xl shadow-2xl overflow-hidden border border-slate-200"
          >
            {/* Elegant Header */}
            <div className="relative h-32 bg-slate-900 flex items-center px-8 sm:px-10 overflow-hidden">
               {/* Background elements */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[80px] rounded-full -mr-20 -mt-20" />
               <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 blur-[60px] rounded-full -ml-10 -mb-10" />
               <div className="absolute inset-0 opacity-10"
                    style={{backgroundImage: 'radial-gradient(circle at 1px 1px, white 0.5px, transparent 0)', backgroundSize: '24px 24px'}} />

               <div className="relative z-10 flex flex-col gap-1">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full w-fit">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Admin Console</span>
                  </div>
                  <h2 className="text-3xl font-black text-white">
                    {isEditing ? 'Modify' : 'Launch'} <span className="text-blue-400">Event</span>
                  </h2>
               </div>

               <button
                  onClick={onClose}
                  className="absolute top-6 right-6 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-2xl transition-all"
               >
                  <X className="w-5 h-5" />
               </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-8 sm:p-10 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-5 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4"
                >
                   <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                      <Activity className="h-5 w-5 text-red-600" />
                   </div>
                   <div className="flex-1">
                      <h4 className="text-sm font-black text-red-900">Submission Error</h4>
                      <p className="text-xs text-red-700 font-medium opacity-80">{error}</p>
                   </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Title */}
                <div className="md:col-span-2 space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Event Title</label>
                  <div className="relative group">
                    <Type className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      {...register("title", { required: true })}
                      placeholder="e.g. Singles Weekend 2026"
                      className="w-full pl-14 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold text-slate-900"
                      onChange={(e) => {
                         const val = e.target.value;
                         setValue("title", val);
                         if (!isEditing) {
                           setValue("slug", val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                         }
                      }}
                    />
                  </div>
                </div>

                {/* Slug */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">URL Identifier (Slug)</label>
                  <div className="relative group">
                    <Link2 className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      {...register("slug", { required: true })}
                      placeholder="singles-weekend-26"
                      className="w-full pl-14 pr-5 py-4 bg-slate-100/50 border border-slate-100 rounded-3xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono text-xs font-bold text-slate-500"
                    />
                  </div>
                </div>

                {/* Date Selection */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">
                    {isRecurring ? "Schedule Anchor (Start)" : "Event Date & Time"}
                  </label>
                  <div className="relative group">
                    <CalendarDays className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                    <input
                      type="datetime-local"
                      {...register("date", { required: true })}
                      className="w-full pl-14 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="md:col-span-2 space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Event Narrative</label>
                  <div className="relative group">
                    <FileText className="absolute left-5 top-5 w-5 h-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                    <textarea
                      {...register("description")}
                      placeholder="Tell the story of this event... What should delegates expect?"
                      className="w-full pl-14 pr-5 py-5 bg-slate-50 border border-slate-100 rounded-4xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-600 min-h-35 resize-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Governance Toggles */}
                <div className="md:col-span-2 space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1 italic">Event Governance</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="relative flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-3xl cursor-pointer hover:bg-white hover:border-blue-200 transition-all group">
                       <input type="checkbox" {...register("is_active")} className="peer sr-only" />
                       <div className="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:bg-green-500 transition-colors relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-6" />
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">Live Status</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Visible to users</span>
                       </div>
                    </label>

                    <label className="relative flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-3xl cursor-pointer hover:bg-white hover:border-blue-200 transition-all group">
                       <input type="checkbox" {...register("is_recurring")} className="peer sr-only" />
                       <div className="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-500 transition-colors relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-6" />
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">Recurring</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Periodic schedule</span>
                       </div>
                    </label>

                    <label className="relative flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-3xl cursor-pointer hover:bg-white hover:border-blue-200 transition-all group">
                       <input type="checkbox" {...register("is_exclusive")} className="peer sr-only" />
                       <div className="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:bg-purple-600 transition-colors relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-6" />
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">Exclusive</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Invite-only view</span>
                       </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-5 pt-8">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-8 py-4 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="relative flex items-center gap-3 px-10 py-4 bg-slate-900 hover:bg-blue-600 text-white rounded-3xl transition-all font-black uppercase tracking-widest text-sm shadow-2xl shadow-slate-900/10 disabled:opacity-50 group"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {isEditing ? <Save className="w-5 h-5 group-hover:scale-110 transition-transform" /> : <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                      {isEditing ? 'Commit Changes' : 'Initialize Event'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
