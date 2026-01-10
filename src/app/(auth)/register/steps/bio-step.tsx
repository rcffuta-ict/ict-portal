"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BioDataSchema, type BioData } from "@rcffuta/ict-lib";
import { registerStepOne } from "../action";
import { Loader2, ArrowRight } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { useState } from "react";

export default function StepBio({
    onSuccess,
}: {
    onSuccess: (id: string) => void;
}) {
    const [serverError, setServerError] = useState("");

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<BioData>({
        resolver: zodResolver(BioDataSchema),
    });

    const onSubmit = async (data: BioData) => {
        setServerError("");
        const res = await registerStepOne(data);

        if (res.success && res.userId) {
            onSuccess(res.userId);
        } else {
            setServerError(res.error || "Something went wrong");
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
                    {serverError}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                        First Name
                    </label>
                    <FormInput
                        {...register("firstName")}
                        className="w-full input-field"
                        placeholder="John"
                    />
                    {errors.firstName && (
                        <p className="text-xs text-red-500">
                            {errors.firstName.message}
                        </p>
                    )}
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                        Last Name
                    </label>
                    <FormInput
                        {...register("lastName")}
                        className="w-full input-field"
                        placeholder="Doe"
                    />
                    {errors.lastName && (
                        <p className="text-xs text-red-500">
                            {errors.lastName.message}
                        </p>
                    )}
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                    Email Address
                </label>
                <FormInput
                    {...register("email")}
                    type="email"
                    className="w-full input-field"
                    placeholder="john@example.com"
                />
                {errors.email && (
                    <p className="text-xs text-red-500">
                        {errors.email.message}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                        Phone
                    </label>
                    <FormInput
                        {...register("phoneNumber")}
                        className="w-full input-field"
                        placeholder="08012345678"
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
                        className="w-full input-field bg-white"
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
                <label className="text-xs font-medium text-gray-700">
                    Date of Birth
                </label>
                <FormInput
                    {...register("dob")}
                    type="date"
                    className="w-full input-field"
                />
                {errors.dob && (
                    <p className="text-xs text-red-500">{errors.dob.message}</p>
                )}
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                    Password
                </label>
                <FormInput
                    {...register("password")}
                    type="password"
                    className="w-full input-field"
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
                        Next Step <ArrowRight className="h-4 w-4" />
                    </span>
                )}
            </button>
        </form>
    );
}
