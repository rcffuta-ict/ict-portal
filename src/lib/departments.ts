/**
 * FUTA faculties and departments.
 *
 * Lifted out of @rcffuta/ict-lib when that dependency was removed. It is static
 * reference data about the university — it belongs in the repo, where it can be read
 * and corrected, rather than behind a package version bump.
 *
 * Three names per department, and they are used differently:
 *   name    the full title, shown to members and stored on the profile
 *   alias   the FUTA course code ("CPE"), which is what appears on a matric card
 *   faculty the school it sits under
 *
 * Client-safe: plain data, no imports.
 */

export const FACULTY_NAMES: Record<string, string> = {
    "SAAT": "School of Agriculture and Agricultural Technology",
    "SESE": "School of Electrical/Electronics and Computer Engineering",
    "SIMME": "School of Industrial, Mining and Metallurgical Engineering",
    "SEMS": "School of Earth and Mineral Sciences",
    "SET": "School of Environmental Technology",
    "SPS": "School of Physical Sciences",
    "SLS": "School of Life Sciences",
    "SLIT": "School of Logistics and Innovation Technology",
    "SOC": "School of Computing",
    "SBMS": "School of Basic Medical Sciences",
    "SCS": "School of Clinical Sciences"
};

export interface Department {
    faculty: string;
    name: string;
    alias: string;
}

/** Every department, ordered as the source had them (grouped by faculty). */
export const FUTA_DEPARTMENTS: Department[] = [
    {
        "faculty": "SAAT",
        "name": "Agricultural Extension and Communication",
        "alias": "AEC"
    },
    {
        "faculty": "SESE",
        "name": "Computer Engineering",
        "alias": "CPE"
    },
    {
        "faculty": "SIMME",
        "name": "Chemical Engineering",
        "alias": "CEE"
    },
    {
        "faculty": "SEMS",
        "name": "Applied Geology",
        "alias": "AGY"
    },
    {
        "faculty": "SET",
        "name": "Architecture",
        "alias": "ARC"
    },
    {
        "faculty": "SPS",
        "name": "Physics Electronics",
        "alias": "PHY"
    },
    {
        "faculty": "SLS",
        "name": "Biology",
        "alias": "BIO"
    },
    {
        "faculty": "SLIT",
        "name": "Logistics and Transport Technology",
        "alias": "LTT"
    },
    {
        "faculty": "SOC",
        "name": "Computer Science",
        "alias": "CSC"
    },
    {
        "faculty": "SAAT",
        "name": "Food Science and Technology",
        "alias": "FST"
    },
    {
        "faculty": "SESE",
        "name": "Electrical and Electronics Engineering",
        "alias": "EEE"
    },
    {
        "faculty": "SIMME",
        "name": "Civil and Environmental Engineering",
        "alias": "CVE"
    },
    {
        "faculty": "SEMS",
        "name": "Applied Geophysics",
        "alias": "AGP"
    },
    {
        "faculty": "SET",
        "name": "Surveying and Geoinformatics",
        "alias": "SVG"
    },
    {
        "faculty": "SBMS",
        "name": "Industrial Chemistry",
        "alias": "CHE"
    },
    {
        "faculty": "SLS",
        "name": "Biochemistry",
        "alias": "BCH"
    },
    {
        "faculty": "SLIT",
        "name": "Project Management Technology",
        "alias": "PMT"
    },
    {
        "faculty": "SOC",
        "name": "Cyber Security",
        "alias": "CYS"
    },
    {
        "faculty": "SBMS",
        "name": "Physiology",
        "alias": "PHS"
    },
    {
        "faculty": "SAAT",
        "name": "Crop Science and Pest Management",
        "alias": "CSP"
    },
    {
        "faculty": "SBMS",
        "name": "Information and Communication Technology",
        "alias": "ICT"
    },
    {
        "faculty": "SIMME",
        "name": "Agricultural and Environmental Engineering",
        "alias": "AGE"
    },
    {
        "faculty": "SEMS",
        "name": "Remote Sensing and GIS",
        "alias": "RSG"
    },
    {
        "faculty": "SET",
        "name": "Urban and Regional Planning",
        "alias": "URP"
    },
    {
        "faculty": "SBMS",
        "name": "Mathematical Sciences",
        "alias": "MTS"
    },
    {
        "faculty": "SLS",
        "name": "Biotechnology",
        "alias": "BTH"
    },
    {
        "faculty": "SBMS",
        "name": "Security and Investment Management Technology",
        "alias": "SIMT"
    },
    {
        "faculty": "SOC",
        "name": "Software Engineering",
        "alias": "SEN"
    },
    {
        "faculty": "SBMS",
        "name": "Human Anatomy",
        "alias": "ANA"
    },
    {
        "faculty": "SAAT",
        "name": "Forestry and Wood Technology",
        "alias": "FWT"
    },
    {
        "faculty": "SESE",
        "name": "Mechatronics Engineering",
        "alias": "MCE"
    },
    {
        "faculty": "SIMME",
        "name": "Mechanical Engineering",
        "alias": "MEE"
    },
    {
        "faculty": "SEMS",
        "name": "Meteorology and Climate Science",
        "alias": "MCS"
    },
    {
        "faculty": "SET",
        "name": "Estate Management",
        "alias": "ESM"
    },
    {
        "faculty": "SBMS",
        "name": "Statistics",
        "alias": "STA"
    },
    {
        "faculty": "SLS",
        "name": "Microbiology",
        "alias": "MCB"
    },
    {
        "faculty": "SLIT",
        "name": "Business Information Technology",
        "alias": "BIT"
    },
    {
        "faculty": "SBMS",
        "name": "Information Technology",
        "alias": "IFT"
    },
    {
        "faculty": "SAAT",
        "name": "Fisheries and Aquaculture Technology",
        "alias": "FAT"
    },
    {
        "faculty": "SESE",
        "name": "Biomedical Engineering",
        "alias": "BME"
    },
    {
        "faculty": "SIMME",
        "name": "Mining Engineering",
        "alias": "MNE"
    },
    {
        "faculty": "SEMS",
        "name": "Marine Science and Technology",
        "alias": "MST"
    },
    {
        "faculty": "SET",
        "name": "Building Technology",
        "alias": "BDG"
    },
    {
        "faculty": "SCS",
        "name": "Library and Information Science",
        "alias": "LIS"
    },
    {
        "faculty": "SLIT",
        "name": "Entrepreneurship and Management Technology",
        "alias": "ENT"
    },
    {
        "faculty": "SOC",
        "name": "Information Systems",
        "alias": "IFS"
    },
    {
        "faculty": "SBMS",
        "name": "Medical Laboratory Sciences",
        "alias": "MLS"
    },
    {
        "faculty": "SAAT",
        "name": "Agricultural Resources Economics",
        "alias": "ARE"
    },
    {
        "faculty": "SIMME",
        "name": "Materials and Metallurgical Engineering",
        "alias": "MME"
    },
    {
        "faculty": "SET",
        "name": "Industrial Design",
        "alias": "IDD"
    },
    {
        "faculty": "SCS",
        "name": "Public Health",
        "alias": "PHT"
    },
    {
        "faculty": "SAAT",
        "name": "Ecotourism and Wildlife Management",
        "alias": "EWM"
    },
    {
        "faculty": "SIMME",
        "name": "Industrial and Production Engineering",
        "alias": "IPE"
    },
    {
        "faculty": "SET",
        "name": "Quantity Surveying",
        "alias": "QSV"
    },
    {
        "faculty": "SBMS",
        "name": "Medicine and Surgery",
        "alias": "MBBS"
    },
    {
        "faculty": "SAAT",
        "name": "Animal Production and Health",
        "alias": "APH"
    },
    {
        "faculty": "SAAT",
        "name": "Nutrition and Dietetics",
        "alias": "NDT"
    }
];

/** Department lookups. Mirrors the shape the old SDK exposed, minus what nothing used. */
export const DepartmentUtils = {
    /** Every department as a { label, value } pair for a <select>. */
    getAllNames(): { label: string; value: string }[] {
        return FUTA_DEPARTMENTS.map((d) => ({ label: d.name, value: d.alias }));
    },

    /** Find a department by its course code. Case-insensitive. */
    getByAlias(alias: string): Department | undefined {
        const needle = alias?.trim().toUpperCase();
        return FUTA_DEPARTMENTS.find((d) => d.alias.toUpperCase() === needle);
    },

    /** Find a department by its full name. Case-insensitive. */
    getByName(name: string): Department | undefined {
        const needle = name?.trim().toLowerCase();
        return FUTA_DEPARTMENTS.find((d) => d.name.toLowerCase() === needle);
    },

    /** The school a department sits under, e.g. "School of Physical Sciences". */
    getFacultyName(faculty: string): string | undefined {
        return FACULTY_NAMES[faculty];
    },
};
