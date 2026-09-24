/**
 * Loads faculties and departments from the database. Server-only: it reads the
 * service-role client. Client components get the list through `useDepartments()`.
 */
import { cache } from "react";
import { db } from "@/lib/db";
import type { DepartmentOption, Faculty } from "@/lib/departments";

/** Every faculty, by name. Cached for the request. */
export const getFaculties = cache(async (): Promise<Faculty[]> => {
    const { data, error } = await db.from("faculties").select("code, name").order("name");
    if (error) throw new Error(`Couldn't load faculties: ${error.message}`);
    return (data ?? []) as Faculty[];
});

/**
 * Every department, by name, with its school's name. Deactivated ones are included
 * only when asked: forms offer the active list, but a member already recorded against
 * a retired department must still see its name.
 */
export const getDepartments = cache(async (includeInactive = false): Promise<DepartmentOption[]> => {
    let query = db
        .from("departments")
        .select("id, alias, name, faculty_code, is_active, faculty:faculties(name)")
        .order("name");
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) throw new Error(`Couldn't load departments: ${error.message}`);
    return (data ?? []).map((d) => ({
        id: d.id as string,
        alias: d.alias as string,
        name: d.name as string,
        facultyCode: d.faculty_code as string,
        facultyName: (d.faculty as unknown as { name: string } | null)?.name ?? null,
        isActive: d.is_active as boolean,
    }));
});
