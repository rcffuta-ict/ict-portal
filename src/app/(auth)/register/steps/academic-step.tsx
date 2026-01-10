"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    AcademicDataSchema,
    type AcademicData,
    DepartmentUtils,
} from "@rcffuta/ict-lib";
import { registerStepTwo, getFamiliesAction } from "../action"; // Import new action
import { Loader2, ArrowRight } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { useEffect, useState } from "react";

// Hardcode current session year for display calculation (e.g., 2025/2026 session -> 2025)
const CURRENT_SESSION_YEAR = 2025; 

export default function StepAcademic({
    userId,
    onSuccess,
}: {
    userId: string;
    onSuccess: () => void;
}) {
    const [families, setFamilies] = useState<any[]>([]);
    const [isLoadingFamilies, setIsLoadingFamilies] = useState(true);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<AcademicData>({
        resolver: zodResolver(AcademicDataSchema),
    });

    // 1. Fetch Families on Mount
    useEffect(() => {
        async function load() {
            const res = await getFamiliesAction();
            if (res.success && res.data) {
                setFamilies(res.data);
            }
            setIsLoadingFamilies(false);
        }
        load();
    }, []);

    const onSubmit = async (data: AcademicData) => {
        const res = await registerStepTwo(userId, data);
        if (res.success) onSuccess();
        else alert(res.error);
    };

    const departments = DepartmentUtils.getAllNames();

    // Helper to calculate display level (e.g. "100L")
    const getDisplayLevel = (entryYear: number) => {
        const level = (CURRENT_SESSION_YEAR - entryYear + 1) * 100;
        if (level < 100) return "Pre-Degree / Aspirant";
        if (level > 500) return "Alumni / Extra Year";
        return `${level}L`;
    };

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 animate-fade-in"
        >
            {/* 1. Matric Number */}
            <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                    Matric Number
                </label>
                <FormInput
                    {...register("matricNumber")}
                    className="w-full input-field uppercase"
                    placeholder="ABC/21/0000"
                    isMatric={true}
                />
                <p className="text-[10px] text-gray-400">
                    Format: DEPT/YY/NUM (e.g. MEE/19/8821)
                </p>
                {errors.matricNumber && (
                    <p className="text-xs text-red-500">
                        {errors.matricNumber.message}
                    </p>
                )}
            </div>

            {/* 2. Department Select */}
            <div className="space-y-1">
                <FormSelect
                    {...register("department")}
                    label="Department"
                    className="w-full input-field bg-white"
                >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                        <option key={dept.value} value={dept.value}>
                            {dept.label}
                        </option>
                    ))}
                </FormSelect>
                {errors.department && (
                    <p className="text-xs text-red-500">
                        {errors.department.message}
                    </p>
                )}
            </div>

            {/* 3. Family / Generation Select */}
            <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                    Academic Level / Family
                </label>
                <div className="relative">
                    <select
                        {...register("classSetId")}
                        className="w-full input-field bg-white disabled:opacity-50"
                        disabled={isLoadingFamilies}
                    >
                        <option value="">Select your Set</option>
                        {families.map((f) => (
                            <option key={f.id} value={f.id}>
                                {getDisplayLevel(f.entry_year)} —{" "}
                                {f.family_name || "Unnamed Generation"} (
                                {f.entry_year} Set)
                            </option>
                        ))}
                    </select>
                    {isLoadingFamilies && (
                        <div className="absolute right-3 top-2.5">
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </div>
                    )}
                </div>
                {errors.classSetId && (
                    <p className="text-xs text-red-500">
                        {errors.classSetId.message}
                    </p>
                )}
                <p className="text-[10px] text-gray-400">
                    Your "Family Name" follows you from 100L to 500L.
                </p>
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