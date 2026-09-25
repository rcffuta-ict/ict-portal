"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
    AlertTriangle,
    Check,
    ClipboardList,
    Loader2,
    Lock,
    MapPin,
    Save,
    X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { createEvent, listEventUnitsAction, updateEvent } from "@/app/events/actions";
import {
    EVENT_TIME_ZONE_LABEL,
    EventConfig,
    EventRecord,
    fromDateTimeLocalValue,
    getEventLocation,
    getEventUnitSlug,
    getRegistrationConfig,
    toDateTimeLocalValue,
} from "@/lib/event-utils";

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    event?: EventRecord | null; // If provided, we are in edit mode
}

interface EventFormData {
    title: string;
    slug: string;
    description: string;
    date: string;
    venue: string;
    address: string;
    mapUrl: string;
    /** Slug of the unit running the event ("" = none). Its leadership gets the console. */
    unit: string;
    is_active: boolean;
    is_recurring: boolean;
    is_exclusive: boolean;
    // Registration config
    requires_registration: boolean;
    reg_fields: string[];
    reg_allow_guest: boolean;
    reg_allow_alumni: boolean;
    reg_allow_students: boolean;
}

const PROFILE_FIELDS = [
    { id: "firstName", label: "First name" },
    { id: "lastName", label: "Last name" },
    { id: "email", label: "Email address" },
    { id: "phone", label: "Phone number" },
    { id: "gender", label: "Gender" },
    { id: "level", label: "Level / status" },
    { id: "department", label: "Department" },
    { id: "matricNumber", label: "Matric number" },
];

const EMPTY_FORM: EventFormData = {
    title: "",
    slug: "",
    description: "",
    date: "",
    venue: "",
    address: "",
    mapUrl: "",
    unit: "",
    is_active: true,
    is_recurring: false,
    is_exclusive: false,
    requires_registration: false,
    reg_fields: ["firstName", "lastName", "email"],
    reg_allow_guest: true,
    reg_allow_alumni: true,
    reg_allow_students: true,
};

const fieldClass =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

function Toggle({
    label,
    hint,
    ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
    return (
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-rcf-navy/30">
            <input type="checkbox" className="peer sr-only" {...rest} />
            <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-200 transition-colors after:absolute after:top-1 after:left-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-rcf-navy peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-rcf-navy/20" />
            <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{label}</span>
                {hint && <span className="block text-xs text-slate-500">{hint}</span>}
            </span>
        </label>
    );
}

export function EventModal({ isOpen, onClose, onSuccess, event }: EventModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const reduceMotion = useReducedMotion();
    const isEditing = !!event;
    const [units, setUnits] = useState<{ slug: string; name: string; type: string }[]>([]);

    // Loaded when the form opens (the list is short, and only the System Admin sees it).
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        listEventUnitsAction()
            .then((u) => {
                if (!cancelled) setUnits(u as { slug: string; name: string; type: string }[]);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<EventFormData>({ defaultValues: EMPTY_FORM });

    // Reset/populate the form each time the modal opens.
    useEffect(() => {
        if (!isOpen) return;

        if (!event) {
            reset({ ...EMPTY_FORM, date: toDateTimeLocalValue(new Date()) });
            return;
        }

        const regConfig = getRegistrationConfig(event.config);
        const location = getEventLocation(event.config);

        reset({
            title: event.title,
            slug: event.slug,
            description: event.description || "",
            // Lagos wall-clock, so re-saving does not drift the event's time.
            date: toDateTimeLocalValue(event.date),
            venue: location?.venue || "",
            address: location?.address || "",
            mapUrl: location?.mapUrl || "",
            unit: getEventUnitSlug(event.config) ?? "",
            is_active: event.is_active,
            is_recurring: !!event.is_recurring,
            is_exclusive: !!event.is_exclusive,
            requires_registration: regConfig.enabled,
            reg_fields: regConfig.fields.length
                ? regConfig.fields
                : ["firstName", "lastName", "email"],
            reg_allow_guest: regConfig.allowGuest ?? true,
            reg_allow_alumni: regConfig.allowAlumni ?? true,
            reg_allow_students: regConfig.allowStudents ?? true,
        });
    }, [isOpen, event, reset]);

    const isRecurring = watch("is_recurring");
    const requiresRegistration = watch("requires_registration");
    const selectedFields = watch("reg_fields") || [];

    const handleFieldToggle = (fieldId: string) => {
        const next = selectedFields.includes(fieldId)
            ? selectedFields.filter((f) => f !== fieldId)
            : [...selectedFields, fieldId];
        setValue("reg_fields", next, { shouldDirty: true });
    };

    const onSubmit = async (data: EventFormData) => {
        setIsSubmitting(true);
        setError(null);

        try {
            const existingConfig = (event?.config as EventConfig | null) || {};
            const config: EventConfig = {
                ...existingConfig,
                registration: {
                    enabled: data.requires_registration,
                    fields: data.reg_fields,
                    allowGuest: data.reg_allow_guest,
                    allowAlumni: data.reg_allow_alumni,
                    allowStudents: data.reg_allow_students,
                },
            };

            // The server checks the unit exists; "" clears the assignment.
            config.unit = data.unit || null;

            if (data.venue.trim()) {
                config.location = {
                    venue: data.venue.trim(),
                    address: data.address.trim() || undefined,
                    mapUrl: data.mapUrl.trim() || undefined,
                };
            } else {
                delete config.location;
            }

            const payload = {
                title: data.title,
                slug: data.slug,
                description: data.description,
                is_active: data.is_active,
                is_recurring: data.is_recurring,
                is_exclusive: data.is_exclusive,
                date: fromDateTimeLocalValue(data.date),
                config,
            };

            const result =
                isEditing && event
                    ? await updateEvent(event.id, payload)
                    : await createEvent(payload);

            if (result.success) {
                onSuccess?.();
                onClose();
            } else {
                setError(result.error || `Failed to ${isEditing ? "update" : "create"} event`);
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
                        transition={{ type: "tween", duration: 0.2 }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="event-modal-title"
                        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
                    >
                        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-8">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Admin console
                                </p>
                                <h2
                                    id="event-modal-title"
                                    className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl"
                                >
                                    {isEditing ? "Edit event" : "Create event"}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </header>

                        <form
                            onSubmit={handleSubmit(onSubmit)}
                            className="flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-8"
                        >
                            {error && (
                                <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
                                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                                    <p className="text-sm font-medium text-red-700">{error}</p>
                                </div>
                            )}

                            {/* Basics */}
                            <section className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className={labelClass} htmlFor="event-title">
                                        Event title
                                    </label>
                                    <input
                                        id="event-title"
                                        {...register("title", { required: "Title is required" })}
                                        placeholder="e.g. Singles Weekend 2026"
                                        className={fieldClass}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setValue("title", val, { shouldDirty: true });
                                            if (!isEditing) {
                                                setValue(
                                                    "slug",
                                                    val
                                                        .toLowerCase()
                                                        .replace(/[^a-z0-9]+/g, "-")
                                                        .replace(/(^-|-$)/g, ""),
                                                    { shouldDirty: true },
                                                );
                                            }
                                        }}
                                    />
                                    {errors.title && (
                                        <p className="text-xs font-medium text-red-600">
                                            {errors.title.message}
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label className={labelClass} htmlFor="event-slug">
                                            URL identifier
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="event-slug"
                                                {...register("slug", { required: "Slug is required" })}
                                                placeholder="freshers-welcome-27"
                                                readOnly={isEditing}
                                                className={`${fieldClass} font-mono text-xs ${
                                                    isEditing
                                                        ? "cursor-not-allowed bg-slate-50 pr-10 text-slate-400"
                                                        : ""
                                                }`}
                                            />
                                            {isEditing && (
                                                <Lock className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-slate-300" />
                                            )}
                                        </div>
                                        {errors.slug && (
                                            <p className="text-xs font-medium text-red-600">
                                                {errors.slug.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className={labelClass} htmlFor="event-date">
                                            {isRecurring ? "First occurrence" : "Date & time"}
                                            <span className="ml-1 normal-case text-slate-400">
                                                ({EVENT_TIME_ZONE_LABEL})
                                            </span>
                                        </label>
                                        <input
                                            id="event-date"
                                            type="datetime-local"
                                            {...register("date", { required: "Date is required" })}
                                            className={fieldClass}
                                        />
                                        {errors.date && (
                                            <p className="text-xs font-medium text-red-600">
                                                {errors.date.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass} htmlFor="event-description">
                                        Description
                                    </label>
                                    <textarea
                                        id="event-description"
                                        {...register("description")}
                                        rows={4}
                                        placeholder="What should attendees expect?"
                                        className={`${fieldClass} resize-y leading-relaxed`}
                                    />
                                </div>
                            </section>

                            {/* Who runs it */}
                            <section className="space-y-2 border-t border-slate-100 pt-6">
                                <label className={labelClass} htmlFor="event-unit">
                                    Run by
                                </label>
                                <select id="event-unit" {...register("unit")} className={fieldClass}>
                                    <option value="">No unit — central leadership only</option>
                                    {units.map((u) => (
                                        <option key={u.slug} value={u.slug}>
                                            {u.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs leading-relaxed text-slate-500">
                                    The unit&rsquo;s Executive and assistants get this event&rsquo;s
                                    admin console — registrants, questions and door check-in —
                                    alongside the System Admin and the VPs. The President can view it.
                                </p>
                            </section>

                            {/* Location */}
                            <section className="space-y-4 border-t border-slate-100 pt-6">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-rcf-navy" />
                                    <h3 className="text-sm font-bold text-slate-900">Location</h3>
                                </div>
                                <p className="-mt-2 text-xs text-slate-500">
                                    Shown on the event page and the registration screen. Leave the
                                    venue empty if it is still to be announced.
                                </p>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <label className={labelClass} htmlFor="event-venue">
                                            Venue
                                        </label>
                                        <input
                                            id="event-venue"
                                            {...register("venue")}
                                            placeholder="e.g. RCF Auditorium, South Gate"
                                            className={fieldClass}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className={labelClass} htmlFor="event-address">
                                            Address / landmark
                                        </label>
                                        <input
                                            id="event-address"
                                            {...register("address")}
                                            placeholder="FUTA South Campus, Akure"
                                            className={fieldClass}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className={labelClass} htmlFor="event-map">
                                            Map link (optional)
                                        </label>
                                        <input
                                            id="event-map"
                                            type="url"
                                            {...register("mapUrl")}
                                            placeholder="https://maps.google.com/..."
                                            className={fieldClass}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Visibility */}
                            <section className="space-y-4 border-t border-slate-100 pt-6">
                                <h3 className="text-sm font-bold text-slate-900">Visibility</h3>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Toggle
                                        label="Published"
                                        hint="Visible to members"
                                        {...register("is_active")}
                                    />
                                    <Toggle
                                        label="Recurring"
                                        hint="Repeats periodically"
                                        {...register("is_recurring")}
                                    />
                                    <Toggle
                                        label="Exclusive"
                                        hint="Login required"
                                        {...register("is_exclusive")}
                                    />
                                </div>
                            </section>

                            {/* Registration */}
                            <section className="space-y-4 border-t border-slate-100 pt-6">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">
                                            Registration
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Collect attendee details before the event.
                                        </p>
                                    </div>
                                    <Toggle
                                        label="Collect registrations"
                                        {...register("requires_registration")}
                                    />
                                </div>

                                {requiresRegistration && (
                                    <div className="space-y-6 rounded-2xl bg-slate-50 p-4 sm:p-5">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                                <ClipboardList className="h-4 w-4 text-slate-400" />
                                                Fields to collect
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                {PROFILE_FIELDS.map((field) => {
                                                    const isSelected = selectedFields.includes(field.id);
                                                    return (
                                                        <button
                                                            key={field.id}
                                                            type="button"
                                                            aria-pressed={isSelected}
                                                            onClick={() => handleFieldToggle(field.id)}
                                                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                                                isSelected
                                                                    ? "border-rcf-navy bg-white text-rcf-navy"
                                                                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                                                            }`}
                                                        >
                                                            <span
                                                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                                    isSelected
                                                                        ? "border-rcf-navy bg-rcf-navy"
                                                                        : "border-slate-300"
                                                                }`}
                                                            >
                                                                {isSelected && (
                                                                    <Check className="h-3 w-3 text-white" />
                                                                )}
                                                            </span>
                                                            <span className="truncate text-xs font-semibold">
                                                                {field.label}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {selectedFields.includes("level") && (
                                                <p className="text-xs text-slate-500">
                                                    Level is collected, so the admin console will show a
                                                    breakdown of attendees per level.
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <div className="text-sm font-semibold text-slate-900">
                                                Who can register
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-3">
                                                <Toggle
                                                    label="Students"
                                                    hint="Current undergrads"
                                                    {...register("reg_allow_students")}
                                                />
                                                <Toggle
                                                    label="Alumni"
                                                    hint="Graduated members"
                                                    {...register("reg_allow_alumni")}
                                                />
                                                <Toggle
                                                    label="Guests"
                                                    hint="External visitors"
                                                    {...register("reg_allow_guest")}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </form>

                        <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 pb-safe sm:flex-row sm:justify-end sm:px-8">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="rounded-2xl px-6 py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit(onSubmit)}
                                disabled={isSubmitting}
                                className="flex items-center justify-center gap-2 rounded-2xl bg-rcf-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light disabled:opacity-60"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        {isEditing ? "Save changes" : "Create event"}
                                    </>
                                )}
                            </button>
                        </footer>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
