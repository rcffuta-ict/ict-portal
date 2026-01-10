"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    AcademicDataSchema,
    type AcademicData,
    DepartmentUtils,
} from "@rcffuta/ict-lib";
import { registerStepTwo } from "../action";
import { Loader2, ArrowRight } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";

export default function StepAcademic({
    userId,
    onSuccess,
}: {
    userId: string;
    onSuccess: () => void;
}) {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<AcademicData>({
        resolver: zodResolver(AcademicDataSchema),
    });

    const onSubmit = async (data: AcademicData) => {
        const res = await registerStepTwo(userId, data);
        if (res.success) onSuccess();
        else alert(res.error);
    };

    // Get Departments from Lib
    const departments = DepartmentUtils.getAllNames();

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                    Matric Number
                </label>
                <FormInput
                    {...register("matricNumber")}
                    className="w-full input-field"
                    placeholder="ABC/21/0000"
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

            <div className="space-y-1">
                <FormSelect
                    {...register("department")}
                    label="Department"
                    className="w-full input-field bg-white"
                >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                        <option key={dept} value={dept}>
                            {dept}
                        </option>
                    ))}
                </FormSelect>
                {errors.department && (
                    <p className="text-xs text-red-500">
                        {errors.department.message}
                    </p>
                )}
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                    Entry Year
                </label>
                <FormInput
                    {...register("entryYear", { valueAsNumber: true })}
                    type="number"
                    className="w-full input-field"
                    placeholder="2021"
                />
                {errors.entryYear && (
                    <p className="text-xs text-red-500">
                        {errors.entryYear.message}
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
