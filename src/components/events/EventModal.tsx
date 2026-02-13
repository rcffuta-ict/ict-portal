"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Type, FileText, Check, Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { createEvent, updateEvent } from "@/app/events/actions";
import { Event } from "@/app/events/page";

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
            result = await createEvent(payload);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" style={{zIndex: 100}}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{isEditing ? 'Edit Event' : 'Create New Event'}</h2>
                <p className="text-sm text-slate-500">{isEditing ? 'Update event details' : 'Add a new event to the portal'}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
              {/* Error Message */}
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                   {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Title & Slug */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Event Title</label>
                    <div className="relative">
                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        {...register("title", { required: true })}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g. Bible Study"
                        onChange={(e) => {
                             if (!isEditing) {
                                 // Auto-generate slug only if creating?
                                 // Or maybe user wants to change slug too. let's auto-gen only if typing in title and slug field not touched?
                                 // Simpler: Just manual slug or simple auto-gen like before but watch out overwrites.
                                 // Let's keep existing logic but apply it carefully.
                                 const val = e.target.value;
                                 setValue("title", val);
                                 // Only auto-update slug if not editing or maybe just let them manage slug manually if they want
                                 setValue("slug", val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                             } else {
                                setValue("title", e.target.value);
                             }
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Slug</label>
                    <input
                      {...register("slug", { required: true })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 text-slate-500"
                      placeholder="bible-study"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Description</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      {...register("description")}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-20 resize-none"
                      placeholder="Brief description of the event..."
                    />
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    {isRecurring ? "Ordering Date (Start Date)" : "Event Date"}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="datetime-local"
                      {...register("date", { required: true })}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-col gap-3 pt-2">
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group select-none">
                            <input type="checkbox" {...register("is_active")} className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500" />
                            <span className="text-sm text-slate-700 group-hover:text-slate-900">Active</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer group select-none">
                            <input type="checkbox" {...register("is_recurring")} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                            <span className="text-sm text-slate-700 group-hover:text-slate-900">Recurring Event</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer group select-none">
                            <input type="checkbox" {...register("is_exclusive")} className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                            <span className="text-sm text-slate-700 group-hover:text-slate-900">Exclusive Event</span>
                        </label>
                    </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-200"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isEditing ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {isEditing ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      {isEditing ? 'Save Changes' : 'Create Event'}
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
