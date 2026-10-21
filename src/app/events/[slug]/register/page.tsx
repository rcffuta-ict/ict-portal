"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "react-qr-code";
import { Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, useReducedMotion } from "framer-motion";
import {
    AlertCircle,
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    Clock,
    Loader2,
    Lock,
    LogIn,
    MapPin,
    X,
} from "lucide-react";
import { useProfileStore } from "@/lib/stores/profile.store";
import { getEventBySlug, registerForEvent } from "../../actions";
import { CompactPreloader } from "@/components/ui/preloader";
import { Logo } from "@/components/ui/logo";
import { GENDER_OPTIONS } from "@/lib/gender";
import { parseLevelTokenInput } from "@/lib/level-token";
import {
    EVENT_TIME_ZONE_LABEL,
    EventRecord,
    formatEventDate,
    formatEventTime,
    getEventLocation,
    getRegistrationConfig,
    levelOptionsFor,
    parseEventDate,
} from "@/lib/event-utils";

/* -------------------------------------------------------------------------- */
/* Page shell — handles loading / not-found / closed states                    */
/* -------------------------------------------------------------------------- */

export default function GenericEventRegistration() {
    const params = useParams();
    const slug = params.slug as string;

    const [event, setEvent] = useState<EventRecord | null>(null);
    const [testEmailDomain, setTestEmailDomain] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getEventBySlug(slug);
            if (result.success && result.data) {
                setEvent(result.data as EventRecord);
                setTestEmailDomain(result.testEmailDomain ?? null);
            } else {
                setError(result.error || "Event not found");
            }
        } catch (err) {
            console.error("Failed to load event:", err);
            setError("We couldn't load this event. Please check your connection.");
        } finally {
            setLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) {
        return <CompactPreloader title="Loading registration..." showUserIcon={false} />;
    }

    if (error || !event) {
        return (
            <Centered
                title="Registration unavailable"
                description={error || "This event could not be found."}
                icon={<AlertCircle className="h-8 w-8 text-red-500" />}
            >
                <button
                    type="button"
                    onClick={load}
                    className="rounded-2xl bg-rcf-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light"
                >
                    Try again
                </button>
                <Link
                    href="/events"
                    className="rounded-2xl px-6 py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                    Browse events
                </Link>
            </Centered>
        );
    }

    // `event` is settled here, so the form mounts with the final field config.
    return <RegistrationView event={event} slug={slug} testEmailDomain={testEmailDomain} />;
}

/* -------------------------------------------------------------------------- */
/* Form                                                                        */
/* -------------------------------------------------------------------------- */

type FieldName =
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "gender"
    | "level"
    | "department"
    | "matricNumber";
type FormValues = Record<FieldName, string>;

const EMPTY_VALUES: FormValues = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    level: "",
    department: "",
    matricNumber: "",
};

/**
 * Only the fields the admin chose to collect are validated. Outside production the
 * email must also use the test domain (the server refuses anything else anyway).
 */
function buildSchema(fields: string[], testEmailDomain: string | null) {
    const required = (message: string) => z.string().trim().min(1, message);
    const optional = z.string().optional();

    const shape: Record<FieldName, z.ZodTypeAny> = {
        firstName: fields.includes("firstName")
            ? required("Enter your first name")
            : optional,
        lastName: fields.includes("lastName") ? required("Enter your last name") : optional,
        email: fields.includes("email")
            ? z
                .string()
                .trim()
                .min(1, "Enter your email address")
                .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Enter a valid email address")
                .refine(
                    (v) => !testEmailDomain || v.toLowerCase().endsWith(`@${testEmailDomain}`),
                    `This is a test environment: use an @${testEmailDomain} email address.`,
                )
            : optional,
        phone: fields.includes("phone")
            ? z
                .string()
                .trim()
                .min(1, "Enter your phone number")
                .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number")
            : optional,
        gender: fields.includes("gender") ? required("Select an option") : optional,
        level: fields.includes("level") ? required("Select your level") : optional,
        department: fields.includes("department") ? required("Enter your department") : optional,
        matricNumber: fields.includes("matricNumber")
            ? required("Enter your matric number")
            : optional,
    };

    return z.object(shape);
}

function RegistrationView({
    event,
    slug,
    testEmailDomain,
}: {
    event: EventRecord;
    slug: string;
    testEmailDomain: string | null;
}) {
    const user = useProfileStore((e) => e.user);
    const reduceMotion = useReducedMotion();
    const isAuthenticated = !!user;

    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    // The ticket: the new registration's id, rendered as a QR for door check-in.
    const [ticket, setTicket] = useState<{ id: string; name: string } | null>(null);
    const [showLoginHint, setShowLoginHint] = useState(true);

    const regConfig = useMemo(() => getRegistrationConfig(event.config), [event.config]);
    const location = useMemo(() => getEventLocation(event.config), [event.config]);
    const eventDate = useMemo(() => parseEventDate(event.date), [event.date]);
    const levels = useMemo(() => levelOptionsFor(regConfig), [regConfig]);

    const defaultValues = useMemo<FormValues>(() => {
        if (!user?.profile) return EMPTY_VALUES;
        return {
            firstName: user.profile.firstName || "",
            lastName: user.profile.lastName || "",
            email: user.profile.email || "",
            phone: user.profile.phoneNumber || "",
            gender: user.profile.gender || "",
            level: user.academics?.currentLevel || "",
            department: user.academics?.department || "",
            matricNumber: user.academics?.matricNumber || "",
        };
    }, [user]);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(buildSchema(regConfig.fields, testEmailDomain)) as Resolver<FormValues>,
        defaultValues,
    });

    // Profile arrives from the store after hydration; refill once it does.
    useEffect(() => {
        reset(defaultValues);
    }, [defaultValues, reset]);

    const collects = (field: FieldName) => regConfig.fields.includes(field);

    /** The ticket shows the name the SERVER registered (the roster's, for members-only). */
    const onRegistered = (data: unknown, typedName: string) => {
        const reg = data as { id?: string; first_name?: string; last_name?: string } | undefined;
        const name = [reg?.first_name, reg?.last_name].filter(Boolean).join(" ") || typedName;
        if (reg?.id) setTicket({ id: reg.id, name });
        setSubmitted(true);
    };

    const onSubmit = async (values: FormValues) => {
        setSubmitError(null);
        try {
            const result = await registerForEvent({
                event_id: event.id,
                first_name: values.firstName,
                last_name: values.lastName,
                email: values.email,
                phone_number: values.phone,
                gender: values.gender,
                level: values.level,
                department: values.department,
                matric_number: values.matricNumber,
            });

            if (result.success) {
                onRegistered(result.data, `${values.firstName} ${values.lastName}`.trim());
            } else {
                setSubmitError(result.error || "Registration failed. Please try again.");
            }
        } catch (err) {
            console.error("Registration failed:", err);
            setSubmitError("Something went wrong. Please check your connection and retry.");
        }
    };

    if (!regConfig.enabled || !event.is_active) {
        return (
            <Centered
                title="Registration closed"
                description={`Registration for ${event.title} is not open${
                    regConfig.enabled ? " at the moment" : " — no sign-up is needed"
                }.`}
                icon={<X className="h-8 w-8 text-slate-400" />}
            >
                <Link
                    href={`/events/${slug}`}
                    className="rounded-2xl bg-rcf-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light"
                >
                    Event details
                </Link>
            </Centered>
        );
    }

    if (submitted) {
        return (
            <Centered
                title="You're registered"
                description={`Your spot for ${event.title} is confirmed. See you there!`}
                icon={<CheckCircle2 className="h-8 w-8 text-emerald-600" />}
            >
                {ticket && (
                    <figure className="mb-2 rounded-2xl border border-dashed border-slate-300 p-4">
                        <div className="mx-auto w-fit rounded-xl bg-white p-2">
                            <QRCode value={ticket.id} size={168} level="Q" fgColor="currentColor" className="text-rcf-navy" aria-label="Your ticket QR code" />
                        </div>
                        <figcaption className="mt-3 space-y-1 text-center">
                            <p className="text-sm font-bold text-slate-900">{ticket.name}</p>
                            <p className="text-xs leading-relaxed text-slate-500">
                                Your ticket. Screenshot it and show it at the door. Lost it? The
                                team can find you by your phone number or email.
                            </p>
                        </figcaption>
                    </figure>
                )}
                <Link
                    href={`/events/${slug}`}
                    className="rounded-2xl bg-rcf-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light"
                >
                    Event details
                </Link>
                <Link
                    href="/events"
                    className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                    All events
                </Link>
            </Centered>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Event summary — a header on mobile, a side rail from lg up */}
            <div className="lg:flex lg:min-h-screen">
                <aside className="bg-rcf-navy px-4 pt-safe pb-6 text-white sm:px-6 lg:w-2/5 lg:max-w-md lg:shrink-0 lg:px-10 lg:py-10">
                    <div className="mx-auto max-w-lg lg:mx-0">
                        <div className="flex items-center justify-between gap-4 pt-4 lg:pt-0">
                            <Link
                                href={`/events/${slug}`}
                                className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Link>
                            <Logo width={72} variant="white" />
                        </div>

                        <p className="mt-6 text-xs font-semibold tracking-wide text-rcf-gold uppercase">
                            Registration
                        </p>
                        <h1 className="mt-2 text-2xl leading-tight font-bold text-balance lg:text-3xl">
                            {event.title}
                        </h1>

                        <dl className="mt-5 space-y-3 text-sm text-white/80">
                            <div className="flex items-start gap-3">
                                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-rcf-gold" />
                                <div>
                                    <dt className="sr-only">Date</dt>
                                    <dd>{formatEventDate(eventDate)}</dd>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-rcf-gold" />
                                <div>
                                    <dt className="sr-only">Time</dt>
                                    <dd>
                                        {formatEventTime(eventDate)} {EVENT_TIME_ZONE_LABEL}
                                    </dd>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rcf-gold" />
                                <div>
                                    <dt className="sr-only">Location</dt>
                                    <dd>
                                        {location ? location.venue : "Venue to be announced"}
                                        {location?.address && (
                                            <span className="mt-0.5 block text-white/60">
                                                {location.address}
                                            </span>
                                        )}
                                    </dd>
                                </div>
                            </div>
                        </dl>
                    </div>
                </aside>

                <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
                    <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="mx-auto max-w-lg"
                    >
                        {event.is_exclusive ? (
                            <MemberRegistration
                                eventId={event.id}
                                collectsPhone={collects("phone")}
                                signedInName={
                                    isAuthenticated && user?.profile
                                        ? `${user.profile.firstName ?? ""} ${user.profile.lastName ?? ""}`.trim()
                                        : null
                                }
                                onRegistered={onRegistered}
                            />
                        ) : (
                            <>
                                <h2 className="text-xl font-bold text-slate-900">Your details</h2>
                                <p className="mt-1 text-sm text-slate-500">
                            All fields below are required to complete your registration.
                                </p>

                                {!isAuthenticated && showLoginHint && (
                                    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                                        <LogIn className="mt-0.5 h-5 w-5 shrink-0 text-rcf-navy" />
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-slate-900">
                                        Already a member?
                                            </p>
                                            <p className="mt-0.5 text-sm text-slate-500">
                                        Log in and we&apos;ll fill this in for you.
                                            </p>
                                            <div className="mt-3 flex gap-2">
                                                <Link
                                                    href={`/login?returnUrl=/events/${slug}/register`}
                                                    className="rounded-xl bg-rcf-navy px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rcf-navy-light"
                                                >
                                            Log in
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowLoginHint(false)}
                                                    className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
                                                >
                                            Dismiss
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {submitError && (
                                    <div
                                        role="alert"
                                        className="mt-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4"
                                    >
                                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                                        <p className="text-sm font-medium text-red-700">{submitError}</p>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        {collects("firstName") && (
                                            <Field
                                                id="firstName"
                                                label="First name"
                                                error={errors.firstName?.message}
                                            >
                                                <input
                                                    id="firstName"
                                                    autoComplete="given-name"
                                                    className={inputClass(!!errors.firstName)}
                                                    placeholder="Grace"
                                                    {...register("firstName")}
                                                />
                                            </Field>
                                        )}

                                        {collects("lastName") && (
                                            <Field
                                                id="lastName"
                                                label="Last name"
                                                error={errors.lastName?.message}
                                            >
                                                <input
                                                    id="lastName"
                                                    autoComplete="family-name"
                                                    className={inputClass(!!errors.lastName)}
                                                    placeholder="Adeyemi"
                                                    {...register("lastName")}
                                                />
                                            </Field>
                                        )}

                                        {collects("email") && (
                                            <Field
                                                id="email"
                                                label="Email address"
                                                error={errors.email?.message}
                                                className="sm:col-span-2"
                                            >
                                                <input
                                                    id="email"
                                                    type="email"
                                                    inputMode="email"
                                                    autoComplete="email"
                                                    className={inputClass(!!errors.email)}
                                                    placeholder="you@example.com"
                                                    {...register("email")}
                                                />
                                            </Field>
                                        )}

                                        {collects("phone") && (
                                            <Field
                                                id="phone"
                                                label="Phone number"
                                                error={errors.phone?.message}
                                            >
                                                <input
                                                    id="phone"
                                                    type="tel"
                                                    inputMode="tel"
                                                    autoComplete="tel"
                                                    className={inputClass(!!errors.phone)}
                                                    placeholder="080..."
                                                    {...register("phone")}
                                                />
                                            </Field>
                                        )}

                                        {collects("gender") && (
                                            <Field id="gender" label="Gender" error={errors.gender?.message}>
                                                <select
                                                    id="gender"
                                                    className={inputClass(!!errors.gender)}
                                                    {...register("gender")}
                                                >
                                                    <option value="">Select</option>
                                                    {GENDER_OPTIONS.map((o) => (
                                                        <option key={o.value} value={o.value}>{o.fellowshipLabel}</option>
                                                    ))}
                                                </select>
                                            </Field>
                                        )}

                                        {collects("level") && (
                                            <Field
                                                id="level"
                                                label="Level / status"
                                                error={errors.level?.message}
                                            >
                                                <select
                                                    id="level"
                                                    className={inputClass(!!errors.level)}
                                                    {...register("level")}
                                                >
                                                    <option value="">Select</option>
                                                    {levels.map((lvl) => (
                                                        <option key={lvl} value={lvl}>
                                                            {lvl}
                                                        </option>
                                                    ))}
                                                </select>
                                            </Field>
                                        )}

                                        {collects("department") && (
                                            <Field
                                                id="department"
                                                label="Department"
                                                error={errors.department?.message}
                                            >
                                                <input
                                                    id="department"
                                                    className={inputClass(!!errors.department)}
                                                    placeholder="Computer Science"
                                                    {...register("department")}
                                                />
                                            </Field>
                                        )}

                                        {collects("matricNumber") && (
                                            <Field
                                                id="matricNumber"
                                                label="Matric number"
                                                error={errors.matricNumber?.message}
                                            >
                                                <input
                                                    id="matricNumber"
                                                    className={inputClass(!!errors.matricNumber)}
                                                    placeholder="CSC/20/1234"
                                                    {...register("matricNumber")}
                                                />
                                            </Field>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rcf-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                        Submitting...
                                            </>
                                        ) : (
                                            "Complete registration"
                                        )}
                                    </button>

                                    <p className="pb-safe text-center text-xs text-slate-400">
                                Your details are used only for this event.
                                    </p>
                                </form>
                            </>
                        )}
                    </motion.div>
                </main>
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Members-only (exclusive) events                                             */
/* -------------------------------------------------------------------------- */

const memberSchema = z.object({
    levelToken: z
        .string()
        .trim()
        .min(1, "Enter your level token")
        .refine((v) => parseLevelTokenInput(v) !== null, "That doesn't look like a level token, e.g. RCF-7KX2P"),
    email: z
        .string()
        .trim()
        .min(1, "Enter your email address")
        .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Enter a valid email address"),
    phone: z
        .string()
        .trim()
        .refine((v) => !v || /^[0-9+\-\s()]{7,20}$/.test(v), "Enter a valid phone number")
        .optional(),
});
type MemberValues = z.infer<typeof memberSchema>;

/**
 * Registration for an event only fellowship members may attend.
 *
 * Members prove who they are with their level token and the email on their record —
 * no login, since most members have none. The server checks the pair against the
 * roster and registers them with their recorded details (src/lib/event-member.ts), so
 * there is nothing else to fill in. A signed-in leader is recognised from their session.
 */
function MemberRegistration({
    eventId,
    collectsPhone,
    signedInName,
    onRegistered,
}: {
    eventId: string;
    collectsPhone: boolean;
    signedInName: string | null;
    onRegistered: (data: unknown, typedName: string) => void;
}) {
    const [submitError, setSubmitError] = useState<string | null>(null);
    // The signed-in path has no fields to validate, so it can't use the form's pending flag.
    const [registering, setRegistering] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<MemberValues>({
        resolver: zodResolver(memberSchema),
        defaultValues: { levelToken: "", email: "", phone: "" },
    });

    const submit = async (values?: MemberValues) => {
        setSubmitError(null);
        try {
            const result = await registerForEvent({
                event_id: eventId,
                level_token: values?.levelToken,
                email: values?.email,
                phone_number: values?.phone,
            });
            if (result.success) onRegistered(result.data, signedInName ?? "");
            else setSubmitError(result.error || "Registration failed. Please try again.");
        } catch {
            setSubmitError("Something went wrong. Please check your connection and retry.");
        }
    };

    const errorBox = submitError && (
        <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-sm font-medium text-red-700">{submitError}</p>
        </div>
    );

    const heading = (
        <>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-rcf-navy/5 px-3 py-1 text-xs font-semibold text-rcf-navy">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Members only
            </p>
            <h2 className="mt-3 text-xl font-bold text-slate-900">Confirm you&apos;re a member</h2>
        </>
    );

    // A signed-in leader: the session already says who they are.
    if (signedInName) {
        return (
            <div>
                {heading}
                <p className="mt-1 text-sm text-slate-500">
                    You&apos;re signed in as <span className="font-semibold text-slate-700">{signedInName}</span>.
                    We&apos;ll register you with the details on your member record.
                </p>
                {errorBox}
                <SubmitButton
                    busy={registering}
                    onClick={async () => {
                        if (registering) return;
                        setRegistering(true);
                        await submit();
                        setRegistering(false);
                    }}
                    label="Register me"
                />
            </div>
        );
    }

    return (
        <div>
            {heading}
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Enter your level token (your level coordinator shares it, e.g. <span className="font-mono">RCF-7KX2P</span>)
                and the email on your member record. We&apos;ll register you with your recorded details.
            </p>
            {errorBox}

            <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-5" noValidate>
                <Field id="levelToken" label="Level token" error={errors.levelToken?.message}>
                    <input
                        id="levelToken"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        aria-invalid={!!errors.levelToken}
                        className={`${inputClass(!!errors.levelToken)} font-mono uppercase`}
                        placeholder="RCF-7KX2P"
                        {...register("levelToken")}
                    />
                </Field>

                <Field id="memberEmail" label="Email on your member record" error={errors.email?.message}>
                    <input
                        id="memberEmail"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        aria-invalid={!!errors.email}
                        className={inputClass(!!errors.email)}
                        placeholder="you@example.com"
                        {...register("email")}
                    />
                </Field>

                {collectsPhone && (
                    <Field id="memberPhone" label="Phone number (if not on your record)" error={errors.phone?.message}>
                        <input
                            id="memberPhone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            aria-invalid={!!errors.phone}
                            className={inputClass(!!errors.phone)}
                            placeholder="080..."
                            {...register("phone")}
                        />
                    </Field>
                )}

                <SubmitButton busy={isSubmitting} label="Complete registration" />

                <p className="pb-safe text-center text-xs text-slate-400">
                    Not a member yet? This event is for members of the fellowship. Ask your
                    level coordinator about joining.
                </p>
            </form>
        </div>
    );
}

function SubmitButton({ busy, label, onClick }: { busy: boolean; label: string; onClick?: () => void }) {
    return (
        <button
            type={onClick ? "button" : "submit"}
            onClick={onClick}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-rcf-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light focus:outline-none focus-visible:ring-4 focus-visible:ring-rcf-navy/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {busy ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Registering…
                </>
            ) : (
                label
            )}
        </button>
    );
}

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                       */
/* -------------------------------------------------------------------------- */

function inputClass(hasError: boolean) {
    return `w-full rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:ring-4 ${
        hasError
            ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
            : "border-slate-200 focus:border-rcf-navy focus:ring-rcf-navy/10"
    }`;
}

function Field({
    id,
    label,
    error,
    className = "",
    children,
}: {
    id: string;
    label: string;
    error?: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            <label
                htmlFor={id}
                className="block text-xs font-semibold tracking-wide text-slate-500 uppercase"
            >
                {label}
            </label>
            {children}
            {error && (
                <p className="text-xs font-medium text-red-600" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

function Centered({
    title,
    description,
    icon,
    children,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
                    {icon}
                </div>
                <h1 className="mt-5 text-xl font-bold text-slate-900">{title}</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
                <div className="mt-6 flex flex-col gap-2">{children}</div>
            </div>
        </div>
    );
}
