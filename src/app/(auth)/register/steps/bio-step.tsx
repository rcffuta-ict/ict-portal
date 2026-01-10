"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BioDataSchema, type BioData } from "@rcffuta/ict-lib";
import { sendVerificationOtp, verifyAndCreateUser } from "../action"; // Import new actions
import { Loader2, ArrowRight, MailCheck } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";

export default function StepBio({
    onSuccess,
}: {
    onSuccess: (id: string) => void;
}) {
    const [view, setView] = useState<"FORM" | "OTP">("FORM");
    const [serverError, setServerError] = useState("");
    const [otp, setOtp] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    const {
        register,
        handleSubmit,
        getValues,
        formState: { errors, isSubmitting },
    } = useForm<BioData>({
        resolver: zodResolver(BioDataSchema),
    });

    // Handle Form Submit -> Send OTP
    const onFormSubmit = async (data: BioData) => {
        setServerError("");
        const res = await sendVerificationOtp(data.email, data.firstName);

        if (res.success) {
            setView("OTP"); // Switch UI
        } else {
            setServerError(res.error || "Failed to send verification code");
        }
    };

    // Handle OTP Submit -> Create User
    const onOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        setServerError("");

        const formData = getValues(); // Get the data from the form state
        const res = await verifyAndCreateUser(otp, formData);

        if (res.success && res.userId) {
            onSuccess(res.userId);
        } else {
            setServerError(res.error || "Invalid code");
            setIsVerifying(false);
        }
    };

    // --- VIEW 1: REGISTRATION FORM ---
    if (view === "FORM") {
        return (
            <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
                {serverError && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
                        {serverError}
                    </div>
                )}

                {/* ... Keep your existing input fields (First Name, Last Name, Email, etc.) ... */}
                {/* JUST COPY YOUR PREVIOUS INPUTS HERE */}
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

    // --- VIEW 2: OTP VERIFICATION ---
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
