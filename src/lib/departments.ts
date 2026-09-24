/**
 * FUTA faculties and departments, as the browser sees them. Client-safe: types and
 * pure helpers only.
 *
 * The list itself lives in the `departments` and `faculties` tables, maintained by the
 * Academic Unit from the Academics module (it used to be a static array in this file,
 * which is now the migration's seed). Server code loads it with
 * `src/lib/departments-db.ts`; client components use `useDepartments()`.
 *
 * Three names per department:
 *   name    the full title, shown to members
 *   alias   the FUTA course code ("CPE"), what appears on a matric card, and what the
 *           portal's forms store in `profiles.department`
 *   faculty the school it sits under
 *
 * `profiles.department_id` is kept in step with the text by a database trigger
 * (`rcf_sync_profile_department`), so every write path agrees without doing anything.
 */

export interface Faculty {
    code: string;
    name: string;
}

export interface DepartmentOption {
    id: string;
    alias: string;
    name: string;
    facultyCode: string;
    facultyName: string | null;
    isActive: boolean;
}

/** Letters and digits only, "&" read as "and": how free text is compared. */
function squash(value: string): string {
    return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

/**
 * The department a stored value refers to. The text holds whatever each path wrote:
 * the course code ("CPE"), the full name, or either typed loosely.
 */
export function findDepartment(
    value: string | null | undefined,
    list: DepartmentOption[],
): DepartmentOption | undefined {
    if (!value?.trim()) return undefined;
    const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const byAlias = list.find((d) => d.alias === code);
    if (byAlias) return byAlias;
    const key = squash(value);
    return list.find((d) => squash(d.name) === key);
}

/** The full name to show for a stored value, or the value itself if nothing matches. */
export function departmentLabel(value: string | null | undefined, list: DepartmentOption[]): string | null {
    if (!value) return null;
    return findDepartment(value, list)?.name ?? value;
}
