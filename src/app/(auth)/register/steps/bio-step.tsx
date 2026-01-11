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
import { z } from "zod";

// --- 1. EXTEND SCHEMA FOR UI VALIDATION ---
// We add confirmPassword and a check to ensure they match
const RegistrationFormSchema = BioDataSchema.extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"], // This ensures the error shows under the confirm field
});

// Infer the type from our new UI schema
type RegistrationFormData = z.infer<typeof RegistrationFormSchema>;

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
    } = useForm<RegistrationFormData>({
        resolver: zodResolver(RegistrationFormSchema),
    });

    // Handle Form Submit
    const onFormSubmit = async (data: RegistrationFormData) => {
        setServerError("");
        // We pass data to the server (extra fields like confirmPassword are ignored by the server action usually, or we can destructure)
        const res = await sendVerificationOtp(data.email, data.firstName);

        if (res.success) {
            setView("OTP");
        } else if (res.userExists) {
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

        // We cast getValues to BioData because verifyAndCreateUser expects the strict Library Type
        // The confirmPassword field inside getValues() will just be ignored by the backend
        const formData = getValues() as BioData;

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

    // --- VIEW 1 & 2 (Registration Form) ---
    if (view === "FORM") {
        return (
            <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
                {serverError && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
                        {serverError}
                    </div>
                )}

                <div className="flex flex-col md:grid grid-cols-2 gap-4">
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

                <div className="flex flex-col md:grid grid-cols-2 gap-4">
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
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
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

                {/* --- PASSWORD & CONFIRM PASSWORD GRID --- */}
                <div className="flex flex-col md:grid grid-cols-2 gap-4">
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
                    <div className="space-y-1">
                        <FormInput
                            {...register("confirmPassword")}
                            label="Confirm Password"
                            type="password"
                            className="w-full"
                            placeholder="•••••••"
                        />
                        {errors.confirmPassword && (
                            <p className="text-xs text-red-500">
                                {errors.confirmPassword.message}
                            </p>
                        )}
                    </div>
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

    // OTP View
    return (
        <form
            onSubmit={onOtpSubmit}
            className="space-y-6 text-center animate-fade-in"
        >
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
