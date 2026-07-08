"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, ArrowRight, ArrowLeft, ShieldAlert, PartyPopper, Lock } from "lucide-react";
import { DepartmentUtils } from "@rcffuta/ict-lib";

import { Logo } from "@/components/ui/logo";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { computeLevel } from "@/lib/levels";
import {
    validateInviteAction,
    submitRegistrationAction,
    setPasswordFromInviteAction,
    getZonesAction,
    type RegistrationPayload,
} from "./action";

type InviteState =
    | { status: "loading" }
    | { status: "invalid"; reason: string }
    | {
          status: "ready";
          purpose: "create" | "update" | "reset";
          classSet: { entryYear: number | null; familyName: string | null; isFoundation: boolean } | null;
          targetName?: string;
          prefill: Record<string, string | null> | null;
      };

export default function RegisterPage() {
    return (
        <Suspense fallback={<CenteredLoader />}>
            <RegisterInner />
        </Suspense>
    );
}

function CenteredLoader() {
    return (
        <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-rcf-navy" />
        </div>
    );
}

function RegisterInner() {
    const params = useSearchParams();
    const token = params.get("invite") || "";
    const [invite, setInvite] = useState<InviteState>(() =>
        token
            ? { status: "loading" }
            : { status: "invalid", reason: "This page requires an invite link from a level coordinator." },
    );

    useEffect(() => {
        if (!token) return;
        let active = true;
        (async () => {
            const res = await validateInviteAction(token);
            if (!active) return;
            if (!res.valid) {
                setInvite({ status: "invalid", reason: res.reason });
            } else {
                setInvite({
                    status: "ready",
                    purpose: res.purpose,
                    classSet: res.classSet
                        ? { entryYear: res.classSet.entryYear, familyName: res.classSet.familyName, isFoundation: res.classSet.isFoundation }
                        : null,
                    targetName: res.targetProfile ? `${res.targetProfile.firstName} ${res.targetProfile.lastName}` : undefined,
                    prefill: res.prefill,
                });
            }
        })();
        return () => {
            active = false;
        };
    }, [token]);

    return (
        <div className="animate-fade-in max-w-3xl mx-auto w-full">
            <div className="flex justify-center md:hidden mb-2">
                <Logo width={80} asLink />
            </div>

            {invite.status === "loading" && <CenteredLoader />}
            {invite.status === "invalid" && <InviteBlocked reason={invite.reason} />}
            {invite.status === "ready" && invite.purpose === "reset" && (
                <ResetPasswordView token={token} name={invite.targetName} />
            )}
            {invite.status === "ready" && invite.purpose !== "reset" && (
                <RegistrationForm token={token} invite={invite} />
            )}
        </div>
    );
}

function InviteBlocked({ reason }: { reason: string }) {
    return (
        <div className="text-center space-y-6 py-8 max-w-md mx-auto">
            <div className="flex justify-center">
                <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                    <ShieldAlert className="h-8 w-8" />
                </div>
            </div>
            <div>
                <h1 className="text-2xl font-bold text-rcf-navy">Invite required</h1>
                <p className="text-sm text-slate-500 mt-2">{reason}</p>
            </div>
            <p className="text-xs text-slate-400">
                Profiles are created through a link shared by your level coordinator. Reach out to
                them to get indexed.
            </p>
            <Link href="/login" className="inline-block font-semibold text-rcf-navy hover:underline">
                Back to login
            </Link>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Registration form (create / update)
// ---------------------------------------------------------------------------

const STEPS = ["Bio Data", "Academics", "Location"] as const;

function RegistrationForm({
    token,
    invite,
}: {
    token: string;
    invite: Extract<InviteState, { status: "ready" }>;
}) {
    const [step, setStep] = useState(0);
    const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
    const [serverError, setServerError] = useState("");
    const [done, setDone] = useState(false);

    const departments = useMemo(() => DepartmentUtils.getAllNames(), []);
    const levelLabel = invite.classSet
        ? computeLevel(invite.classSet.entryYear, invite.classSet.isFoundation, `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`)
        : null;

    const pf = invite.prefill || {};
    const {
        register,
        handleSubmit,
        trigger,
        formState: { errors, isSubmitting },
    } = useForm<RegistrationPayload>({
        defaultValues: {
            firstName: pf.first_name || "",
            lastName: pf.last_name || "",
            middleName: pf.middle_name || "",
            email: pf.email || "",
            phoneNumber: pf.phone_number || "",
            gender: (pf.gender as RegistrationPayload["gender"]) || "",
            dob: pf.dob || "",
            matricNumber: pf.matric_number || "",
            department: pf.department || "",
            schoolAddress: pf.school_address || "",
            homeAddress: pf.home_address || "",
            residentialZoneId: pf.residential_zone_id || "",
        },
    });

    useEffect(() => {
        getZonesAction().then((r) => setZones(r.data || []));
    }, []);

    const stepFields: Record<number, (keyof RegistrationPayload)[]> = {
        0: ["firstName", "lastName", "email", "phoneNumber", "gender"],
        1: ["department"],
        2: ["schoolAddress"],
    };

    const next = async () => {
        const ok = await trigger(stepFields[step]);
        if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
    };

    const onSubmit = async (data: RegistrationPayload) => {
        setServerError("");
        const res = await submitRegistrationAction(token, data);
        if (res.success) {
            setDone(true);
        } else {
            setServerError(res.error || "Something went wrong.");
        }
    };

    if (done) {
        return (
            <div className="text-center space-y-6 py-10 max-w-md mx-auto">
                <div className="flex justify-center">
                    <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                        <PartyPopper className="h-8 w-8" />
                    </div>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-rcf-navy">
                        {invite.purpose === "update" ? "Profile updated" : "You're indexed!"}
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">
                        Your details are saved to the RCF FUTA database
                        {levelLabel ? ` under ${invite.classSet?.familyName || "your generation"} (${levelLabel})` : ""}.
                    </p>
                </div>
                <Link href="/" className="inline-block font-semibold text-rcf-navy hover:underline">
                    Go to homepage
                </Link>
            </div>
        );
    }

    return (
        <>
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-rcf-navy">
                    {invite.purpose === "update" ? "Update your details" : "Get Indexed"}
                </h1>
                <p className="text-sm text-gray-500">
                    {invite.classSet?.familyName ? (
                        <>
                            Joining <span className="font-semibold text-rcf-navy">{invite.classSet.familyName}</span>
                            {levelLabel ? ` · ${levelLabel}` : ""}
                        </>
                    ) : (
                        "Join the official RCF FUTA digital database."
                    )}
                </p>
            </div>

            {/* Stepper */}
            <div className="mb-8 flex items-center justify-between px-2">
                {STEPS.map((label, i) => (
                    <div key={label} className="flex flex-1 items-center last:flex-none">
                        <div className="flex flex-col items-center gap-1">
                            <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                    step > i
                                        ? "bg-green-500 text-white"
                                        : step === i
                                        ? "bg-rcf-navy text-white ring-4 ring-blue-50"
                                        : "bg-gray-100 text-gray-400"
                                }`}
                            >
                                {step > i ? <Check className="h-4 w-4" /> : i + 1}
                            </div>
                            <span className={`text-[10px] font-medium uppercase tracking-wider ${step === i ? "text-rcf-navy" : "text-gray-400"}`}>
                                {label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className={`h-1 flex-1 rounded mx-2 transition-colors ${step > i ? "bg-rcf-navy" : "bg-gray-100"}`} />
                        )}
                    </div>
                ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                {serverError && (
                    <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">{serverError}</div>
                )}

                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                    >
                        {step === 0 && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Field label="First Name" error={errors.firstName?.message}>
                                        <FormInput {...register("firstName", { required: "First name is required" })} placeholder="John" />
                                    </Field>
                                    <Field label="Last Name" error={errors.lastName?.message}>
                                        <FormInput {...register("lastName", { required: "Last name is required" })} placeholder="Doe" />
                                    </Field>
                                </div>
                                <Field label="Email Address" error={errors.email?.message}>
                                    <FormInput {...register("email", { required: "Email is required" })} type="email" placeholder="john@example.com" />
                                </Field>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Field label="Phone" error={errors.phoneNumber?.message}>
                                        <FormInput {...register("phoneNumber", { required: "Phone is required" })} placeholder="08012345678" />
                                    </Field>
                                    <Field label="Gender" error={errors.gender?.message}>
                                        <FormSelect {...register("gender", { required: "Gender is required" })}>
                                            <option value="">Select</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                        </FormSelect>
                                    </Field>
                                </div>
                                <Field label="Date of Birth (optional)">
                                    <FormInput {...register("dob")} type="date" />
                                </Field>
                            </>
                        )}

                        {step === 1 && (
                            <>
                                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
                                    Your generation and level are set by your coordinator&apos;s invite — no need to pick them.
                                </div>
                                <Field label="Matric Number (optional for freshers)" error={errors.matricNumber?.message}>
                                    <FormInput {...register("matricNumber")} className="uppercase" placeholder="MEE/19/8821" />
                                </Field>
                                <Field label="Department" error={errors.department?.message}>
                                    <FormSelect {...register("department", { required: "Department is required" })}>
                                        <option value="">Select Department</option>
                                        {departments.map((d) => (
                                            <option key={d.value} value={d.value}>
                                                {d.label}
                                            </option>
                                        ))}
                                    </FormSelect>
                                </Field>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <Field label="School Address" error={errors.schoolAddress?.message}>
                                    <FormInput {...register("schoolAddress", { required: "School address is required" })} placeholder="Hall / off-campus address" />
                                </Field>
                                <Field label="Home Address (optional)">
                                    <FormInput {...register("homeAddress")} placeholder="Permanent home address" />
                                </Field>
                                <Field label="Residential Zone (optional)">
                                    <FormSelect {...register("residentialZoneId")}>
                                        <option value="">Select zone</option>
                                        {zones.map((z) => (
                                            <option key={z.id} value={z.id}>
                                                {z.name}
                                            </option>
                                        ))}
                                    </FormSelect>
                                </Field>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="mt-6 flex gap-3">
                    {step > 0 && (
                        <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-secondary flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                    )}
                    {step < STEPS.length - 1 ? (
                        <button type="button" onClick={next} className="btn-primary flex-1 flex items-center justify-center gap-2">
                            Next <ArrowRight className="h-4 w-4" />
                        </button>
                    ) : (
                        <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : invite.purpose === "update" ? "Save changes" : "Complete registration"}
                        </button>
                    )}
                </div>
            </form>
        </>
    );
}

// ---------------------------------------------------------------------------
// Reset password (leader, admin-issued invite)
// ---------------------------------------------------------------------------

function ResetPasswordView({ token, name }: { token: string; name?: string }) {
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<{ password: string; confirm: string }>();

    const onSubmit = handleSubmit(async (data) => {
        setError("");
        if (data.password !== data.confirm) {
            setError("Passwords do not match.");
            return;
        }
        const res = await setPasswordFromInviteAction(token, data.password);
        if (res.success) setDone(true);
        else setError(res.error || "Could not set password.");
    });

    if (done) {
        return (
            <div className="text-center space-y-6 py-10 max-w-md mx-auto">
                <div className="flex justify-center">
                    <div className="h-16 w-16 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                        <Check className="h-8 w-8" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-rcf-navy">Password set</h1>
                <p className="text-sm text-slate-500">You can now log in to the portal.</p>
                <Link href="/login" className="inline-block font-semibold text-rcf-navy hover:underline">
                    Go to login
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto py-6">
            <div className="mb-6 text-center">
                <div className="flex justify-center mb-3">
                    <div className="h-14 w-14 bg-blue-50 rounded-full flex items-center justify-center text-rcf-navy">
                        <Lock className="h-7 w-7" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-rcf-navy">Set your password</h1>
                <p className="text-sm text-slate-500 mt-1">
                    {name ? `Hi ${name}, ` : ""}create a password for your leadership login.
                </p>
            </div>

            <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">{error}</div>}
                <Field label="New Password" error={errors.password?.message}>
                    <FormInput
                        {...register("password", { required: "Password is required", minLength: { value: 8, message: "At least 8 characters" } })}
                        type="password"
                        placeholder="••••••••"
                    />
                </Field>
                <Field label="Confirm Password" error={errors.confirm?.message}>
                    <FormInput {...register("confirm", { required: "Please confirm your password" })} type="password" placeholder="••••••••" />
                </Field>
                <button type="submit" disabled={isSubmitting} className="btn-primary w-full flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set password"}
                </button>
            </form>
        </div>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">{label}</label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}
