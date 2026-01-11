"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { BioDataSchema, type BioData } from "@rcffuta/ict-lib";
import { sendVerificationOtp, verifyAndCreateUser } from "../action";
import {
    Loader2,
    ArrowRight,
    MailCheck,
    UserCheck,
    LayoutDashboard,
    ArrowRightCircle,
} from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";

export default function StepBio({
    onSuccess,
}: {
    onSuccess: (id: string) => void;
}) {
    const [view, setView] = useState<"FORM" | "OTP" | "EXISTS">("FORM");
    const [serverError, setServerError] = useState("");
    const [otp, setOtp] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [existingUserId, setExistingUserId] = useState<string | null>(null);

    const router = useRouter();

    const {
        register,
        handleSubmit,
        getValues,
        formState: { errors, isSubmitting },
    } = useForm<BioData>({
        resolver: zodResolver(BioDataSchema),
    });

    // Handle Form Submit
    const onFormSubmit = async (data: BioData) => {
        setServerError("");
        const res = await sendVerificationOtp(data.email, data.firstName);

        if (res.success) {
            setView("OTP");
        } else if (res.userExists) {
            // User found! Switch to "Exists" view
            setExistingUserId(res.userId);
            setView("EXISTS");
        } else {
            setServerError(res.error || "Failed to send verification code");
        }
    };

    // ... onOtpSubmit logic remains same ...
    const onOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        setServerError("");

        const formData = getValues();
        const res = await verifyAndCreateUser(otp, formData);

        if (res.success && res.userId) {
            onSuccess(res.userId);
        } else {
            setServerError(res.error || "Invalid code");
            setIsVerifying(false);
        }
    };

    // --- VIEW 3: USER EXISTS (Smart Prompt) ---
    if (view === "EXISTS") {
        return (
            <div className="text-center space-y-6 animate-fade-in py-4">
                <div className="flex justify-center mb-2">
                    <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                        <UserCheck className="h-8 w-8" />
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-slate-900">
                        Welcome Back!
                    </h3>
                    <p className="text-slate-500 mt-2">
                        We found an account linked to <br />
                        <span className="font-semibold text-slate-700">
                            {getValues("email")}
                        </span>
                    </p>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                    {/* Option A: Continue Registration (Go to Step 2) */}
                    {/* <button
                        onClick={() => onSuccess(existingUserId!)}
                        className="btn-primary w-full bg-blue-600 hover:bg-blue-700 h-12 text-base"
                    >
                        <ArrowRightCircle className="h-5 w-5 mr-2" />
                        Continue Registration
                    </button> */}

                    {/* Option B: Go to Dashboard */}
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="flex items-center justify-center w-full h-12 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                    >
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Go to Dashboard
                    </button>
                </div>

                <button
                    onClick={() => setView("FORM")}
                    className="text-xs text-slate-400 hover:text-slate-600 underline mt-4"
                >
                    Use a different email
                </button>
            </div>
        );
    }

    // --- VIEW 1 & 2 (Remain mostly the same, just keeping the structure) ---
    if (view === "FORM") {
        return (
            // ... (Your Form JSX) ...
            <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
                {/* ... Error & Inputs ... */}
                {serverError && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
                        {serverError}
                    </div>
                )}
                {/* ... (First/Last/Email inputs etc) ... */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <FormInput
                            {...register("firstName")}
                            label="First Name"
                            placeholder="John"
                            className="w-full"
                        />
                        {errors.firstName && (
                            <p className="text-xs text-red-500">
                                {errors.firstName.message}
                            </p>
                        )}
                    </div>
                    <div className="space-y-1">
                        <FormInput
                            {...register("lastName")}
                            label="Last Name"
                            placeholder="Doe"
                            className="w-full"
                        />
                        {errors.lastName && (
                            <p className="text-xs text-red-500">
                                {errors.lastName.message}
                            </p>
                        )}
                    </div>
                </div>

                <div className="space-y-1">
                    <FormInput
                        {...register("email")}
                        label="Email Address"
                        type="email"
                        placeholder="john@example.com"
                        className="w-full"
                    />
                    {errors.email && (
                        <p className="text-xs text-red-500">
                            {errors.email.message}
                        </p>
                    )}
                </div>

                {/* ... Other inputs ... */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <FormInput
                            {...register("phoneNumber")}
                            label="Phone"
                            placeholder="08012345678"
                            className="w-full"
                        />
                        {errors.phoneNumber && (
                            <p className="text-xs text-red-500">
                                {errors.phoneNumber.message}
                            </p>
                        )}
                    </div>
                    <div className="space-y-1">
                        <FormSelect
                            {...register("gender")}
                            label="Gender"
                            className="w-full"
                        >
                            <option value="">Select</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </FormSelect>
                        {errors.gender && (
                            <p className="text-xs text-red-500">
                                {errors.gender.message}
                            </p>
                        )}
                    </div>
                </div>

                <div className="space-y-1">
                    <FormInput
                        {...register("dob")}
                        label="Date of Birth"
                        type="date"
                        className="w-full"
                    />
                    {errors.dob && (
                        <p className="text-xs text-red-500">
                            {errors.dob.message}
                        </p>
                    )}
                </div>

                <div className="space-y-1">
                    <FormInput
                        {...register("password")}
                        label="Password"
                        type="password"
                        className="w-full"
                        placeholder="•••••••"
                    />
                    {errors.password && (
                        <p className="text-xs text-red-500">
                            {errors.password.message}
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full mt-4"
                >
                    {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <span className="flex items-center gap-2">
                            Verify Email <ArrowRight className="h-4 w-4" />
                        </span>
                    )}
                </button>
            </form>
        );
    }

    // OTP View (Keep your existing one)
    return (
        // ... (Your OTP JSX) ...
        <form
            onSubmit={onOtpSubmit}
            className="space-y-6 text-center animate-fade-in"
        >
            {/* ... */}
            <div className="flex justify-center mb-4">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-rcf-navy">
                    <MailCheck className="h-6 w-6" />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold text-rcf-navy">
                    Verify your Email
                </h3>
                <p className="text-sm text-gray-500">
                    We sent a 6-digit code to{" "}
                    <span className="font-bold text-gray-700">
                        {getValues("email")}
                    </span>
                </p>
            </div>

            {serverError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
                    {serverError}
                </div>
            )}

            <div className="flex justify-center">
                <input
                    value={otp}
                    onChange={(e) =>
                        setOtp(
                            e.target.value.replace(/[^0-9]/g, "").slice(0, 6)
                        )
                    }
                    className="text-center text-3xl tracking-[0.5em] font-bold w-48 h-12 border-b-2 border-rcf-navy outline-none focus:border-blue-500 transition-colors bg-transparent"
                    placeholder="------"
                    autoFocus
                />
            </div>

            <button
                type="submit"
                disabled={isVerifying || otp.length < 6}
                className="btn-primary w-full"
            >
                {isVerifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    "Confirm & Create Account"
                )}
            </button>

            <button
                type="button"
                onClick={() => setView("FORM")}
                className="text-xs text-gray-400 hover:text-rcf-navy underline"
            >
                Wrong email? Go back
            </button>
        </form>
    );
}
