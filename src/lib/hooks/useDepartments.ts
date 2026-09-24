"use client";

import { useCallback, useEffect, useState } from "react";
import { listDepartmentsAction } from "@/app/(auth)/profile/action";
import type { DepartmentOption } from "@/lib/departments";

// One request per page load, shared by every component that asks: the list is ~60
// rows and changes a few times a year, and members open these pages on mobile data.
let cached: Promise<DepartmentOption[]> | null = null;

function load(): Promise<DepartmentOption[]> {
    if (!cached) {
        cached = listDepartmentsAction().then((res) => {
            if (!res.success) throw new Error(res.error);
            return res.data;
        });
        // A failure isn't cached, so "Try again" really tries again.
        cached.catch(() => {
            cached = null;
        });
    }
    return cached;
}

/**
 * The department list (active and retired; filter on `isActive` for a picker), with
 * loading and error states and a retry.
 */
export function useDepartments() {
    const [departments, setDepartments] = useState<DepartmentOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setDepartments(await load());
        } catch {
            setError("Couldn't load the departments. Check your connection and try again.");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        // Deferred a tick so the fetch's setState calls happen outside the effect body.
        const t = setTimeout(fetchList, 0);
        return () => clearTimeout(t);
    }, [fetchList]);

    return { departments, loading, error, retry: fetchList };
}
