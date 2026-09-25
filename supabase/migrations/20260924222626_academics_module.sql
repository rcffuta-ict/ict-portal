-- ============================================================================
-- The Academics module: departments, semester rounds and members' results
-- ============================================================================
--
-- Four things, all additive. Nothing is dropped, and no existing column changes type.
--
--   1. faculties + departments. They used to be a static list in the app
--      (src/lib/departments.ts). The Academic Unit now maintains it, so it becomes a
--      table, seeded here with that list. Departments are deactivated, never deleted:
--      profiles point at them.
--   2. profiles.department_id, backfilled from the free-text `department` column. The
--      text columns STAY and keep being written: other applications share this
--      database and read `profiles`.
--   3. academic_rounds / academic_records / academic_settings / academic_submit_attempts.
--      A round is one semester's collection drive ("the round bill"); a record is one
--      member's GPA and CGPA for one semester, on the 5-point scale.
--   4. module_access learns the `academics` module. The Academic Coord
--      (EXCO:academic) reads and writes it by default; Settings can widen that.
--
-- RLS is enabled and forced on every new table with no policies, like every other
-- portal table: the app's service-role client is the only way in.
--
-- Idempotent: IF NOT EXISTS / ON CONFLICT DO NOTHING throughout.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. faculties + departments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.faculties (
    code        text PRIMARY KEY CHECK (code ~ '^[A-Z]{2,10}$'),
    name        text NOT NULL,
    created_at  timestamp with time zone NOT NULL DEFAULT now(),
    updated_at  timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.faculties IS
    'FUTA schools (faculties), keyed by their short code. Maintained from the Academics module.';

CREATE TABLE IF NOT EXISTS public.departments (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The course code on a matric card ("CPE"). Stored upper-case.
    alias         text NOT NULL UNIQUE CHECK (alias ~ '^[A-Z]{2,10}$'),
    name          text NOT NULL,
    faculty_code  text NOT NULL REFERENCES public.faculties(code) ON UPDATE CASCADE,
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamp with time zone NOT NULL DEFAULT now(),
    updated_at    timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.departments IS
    'FUTA departments. Deactivate, never delete: profiles.department_id points here.';

CREATE UNIQUE INDEX IF NOT EXISTS departments_name_key ON public.departments (lower(name));

DROP TRIGGER IF EXISTS faculties_set_updated_at ON public.faculties;
CREATE TRIGGER faculties_set_updated_at BEFORE UPDATE ON public.faculties
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS departments_set_updated_at ON public.departments;
CREATE TRIGGER departments_set_updated_at BEFORE UPDATE ON public.departments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.faculties (code, name) VALUES
    ('SAAT', 'School of Agriculture and Agricultural Technology'),
    ('SESE', 'School of Electrical/Electronics and Computer Engineering'),
    ('SIMME', 'School of Industrial, Mining and Metallurgical Engineering'),
    ('SEMS', 'School of Earth and Mineral Sciences'),
    ('SET', 'School of Environmental Technology'),
    ('SPS', 'School of Physical Sciences'),
    ('SLS', 'School of Life Sciences'),
    ('SLIT', 'School of Logistics and Innovation Technology'),
    ('SOC', 'School of Computing'),
    ('SBMS', 'School of Basic Medical Sciences'),
    ('SCS', 'School of Clinical Sciences')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.departments (alias, name, faculty_code) VALUES
    ('AEC', 'Agricultural Extension and Communication', 'SAAT'),
    ('CPE', 'Computer Engineering', 'SESE'),
    ('CEE', 'Chemical Engineering', 'SIMME'),
    ('AGY', 'Applied Geology', 'SEMS'),
    ('ARC', 'Architecture', 'SET'),
    ('PHY', 'Physics Electronics', 'SPS'),
    ('BIO', 'Biology', 'SLS'),
    ('LTT', 'Logistics and Transport Technology', 'SLIT'),
    ('CSC', 'Computer Science', 'SOC'),
    ('FST', 'Food Science and Technology', 'SAAT'),
    ('EEE', 'Electrical and Electronics Engineering', 'SESE'),
    ('CVE', 'Civil and Environmental Engineering', 'SIMME'),
    ('AGP', 'Applied Geophysics', 'SEMS'),
    ('SVG', 'Surveying and Geoinformatics', 'SET'),
    ('CHE', 'Industrial Chemistry', 'SBMS'),
    ('BCH', 'Biochemistry', 'SLS'),
    ('PMT', 'Project Management Technology', 'SLIT'),
    ('CYS', 'Cyber Security', 'SOC'),
    ('PHS', 'Physiology', 'SBMS'),
    ('CSP', 'Crop Science and Pest Management', 'SAAT'),
    ('ICT', 'Information and Communication Technology', 'SBMS'),
    ('AGE', 'Agricultural and Environmental Engineering', 'SIMME'),
    ('RSG', 'Remote Sensing and GIS', 'SEMS'),
    ('URP', 'Urban and Regional Planning', 'SET'),
    ('MTS', 'Mathematical Sciences', 'SBMS'),
    ('BTH', 'Biotechnology', 'SLS'),
    ('SIMT', 'Security and Investment Management Technology', 'SBMS'),
    ('SEN', 'Software Engineering', 'SOC'),
    ('ANA', 'Human Anatomy', 'SBMS'),
    ('FWT', 'Forestry and Wood Technology', 'SAAT'),
    ('MCE', 'Mechatronics Engineering', 'SESE'),
    ('MEE', 'Mechanical Engineering', 'SIMME'),
    ('MCS', 'Meteorology and Climate Science', 'SEMS'),
    ('ESM', 'Estate Management', 'SET'),
    ('STA', 'Statistics', 'SBMS'),
    ('MCB', 'Microbiology', 'SLS'),
    ('BIT', 'Business Information Technology', 'SLIT'),
    ('IFT', 'Information Technology', 'SBMS'),
    ('FAT', 'Fisheries and Aquaculture Technology', 'SAAT'),
    ('BME', 'Biomedical Engineering', 'SESE'),
    ('MNE', 'Mining Engineering', 'SIMME'),
    ('MST', 'Marine Science and Technology', 'SEMS'),
    ('BDG', 'Building Technology', 'SET'),
    ('LIS', 'Library and Information Science', 'SCS'),
    ('ENT', 'Entrepreneurship and Management Technology', 'SLIT'),
    ('IFS', 'Information Systems', 'SOC'),
    ('MLS', 'Medical Laboratory Sciences', 'SBMS'),
    ('ARE', 'Agricultural Resources Economics', 'SAAT'),
    ('MME', 'Materials and Metallurgical Engineering', 'SIMME'),
    ('IDD', 'Industrial Design', 'SET'),
    ('PHT', 'Public Health', 'SCS'),
    ('EWM', 'Ecotourism and Wildlife Management', 'SAAT'),
    ('IPE', 'Industrial and Production Engineering', 'SIMME'),
    ('QSV', 'Quantity Surveying', 'SET'),
    ('MBBS', 'Medicine and Surgery', 'SBMS'),
    ('APH', 'Animal Production and Health', 'SAAT'),
    ('NDT', 'Nutrition and Dietetics', 'SAAT')
ON CONFLICT (alias) DO NOTHING;

ALTER TABLE public.faculties   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. profiles.department_id
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS department_id uuid
        REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_department_id_idx ON public.profiles (department_id);

-- The free text holds whatever each path wrote: the app's forms saved the course code
-- ("CPE"), the test seed saved the full name, and people typed "&" for "and". Compare
-- on letters and digits only, alias first, then name. Anything still unmatched stays
-- NULL and is listed in the Academics module for somebody to link by hand.
UPDATE public.profiles p
   SET department_id = d.id
  FROM public.departments d
 WHERE p.department_id IS NULL
   AND p.department IS NOT NULL
   AND upper(regexp_replace(p.department, '[^A-Za-z0-9]', '', 'g')) = d.alias;

UPDATE public.profiles p
   SET department_id = d.id
  FROM public.departments d
 WHERE p.department_id IS NULL
   AND p.department IS NOT NULL
   AND regexp_replace(lower(replace(p.department, '&', 'and')), '[^a-z0-9]', '', 'g')
     = regexp_replace(lower(replace(d.name, '&', 'and')), '[^a-z0-9]', '', 'g');

-- Keep the two in step on every write, whoever makes it: the portal's forms, Oracle's
-- free-text edit, a seed script, or another application sharing this table.
--
--   * `department` text changed (and department_id didn't): resolve the id from it,
--     the same way as the backfill above, and set the school to match. Unmatched text
--     leaves department_id NULL and the school untouched.
--   * department_id changed (the Academics module linking a member by hand): write
--     the course code into `department` and the school into `faculty`, which is what
--     the portal's own forms have always stored.
CREATE OR REPLACE FUNCTION public.rcf_sync_profile_department()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_dept public.departments%ROWTYPE;
    v_id_changed   boolean;
    v_text_changed boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_id_changed   := NEW.department_id IS NOT NULL;
        v_text_changed := NOT v_id_changed AND NEW.department IS NOT NULL;
    ELSE
        v_id_changed   := NEW.department_id IS DISTINCT FROM OLD.department_id;
        v_text_changed := NOT v_id_changed AND NEW.department IS DISTINCT FROM OLD.department;
    END IF;

    IF v_id_changed AND NEW.department_id IS NOT NULL THEN
        SELECT * INTO v_dept FROM public.departments WHERE id = NEW.department_id;
        IF FOUND THEN
            NEW.department := v_dept.alias;
            NEW.faculty    := v_dept.faculty_code;
        END IF;
    ELSIF v_text_changed THEN
        IF NEW.department IS NULL OR btrim(NEW.department) = '' THEN
            NEW.department_id := NULL;
        ELSE
            SELECT * INTO v_dept FROM public.departments d
             WHERE d.alias = upper(regexp_replace(NEW.department, '[^A-Za-z0-9]', '', 'g'))
                OR regexp_replace(lower(replace(d.name, '&', 'and')), '[^a-z0-9]', '', 'g')
                 = regexp_replace(lower(replace(NEW.department, '&', 'and')), '[^a-z0-9]', '', 'g')
             ORDER BY (d.alias = upper(regexp_replace(NEW.department, '[^A-Za-z0-9]', '', 'g'))) DESC
             LIMIT 1;
            IF FOUND THEN
                NEW.department_id := v_dept.id;
                NEW.faculty       := v_dept.faculty_code;
            ELSE
                NEW.department_id := NULL;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_department ON public.profiles;
CREATE TRIGGER profiles_sync_department
    BEFORE INSERT OR UPDATE OF department, department_id ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.rcf_sync_profile_department();

-- ----------------------------------------------------------------------------
-- 3. Rounds, records, settings, attempts
-- ----------------------------------------------------------------------------

-- One semester's collection drive. The token is shared with every member
-- (`/results?round=ACD-7KX2P`); it is not a secret credential, only a way in.
CREATE TABLE IF NOT EXISTS public.academic_rounds (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session     text NOT NULL CHECK (session ~ '^[0-9]{4}/[0-9]{4}$'),
    -- 1 = Harmattan (first) semester, 2 = Rain (second) semester.
    semester    smallint NOT NULL CHECK (semester IN (1, 2)),
    token       text NOT NULL UNIQUE CHECK (token ~ '^acd-[a-z0-9]{5}$'),
    opens_at    timestamp with time zone NOT NULL DEFAULT now(),
    -- Informational deadline shown to members. The round is open until closed_at is set.
    closes_at   timestamp with time zone,
    closed_at   timestamp with time zone,
    created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (session, semester)
);

COMMENT ON TABLE public.academic_rounds IS
    'A semester''s results collection. Open while closed_at IS NULL; at most one is open.';

-- One open round at a time, fellowship-wide.
CREATE UNIQUE INDEX IF NOT EXISTS academic_rounds_one_open
    ON public.academic_rounds ((true)) WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.academic_records (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session       text NOT NULL CHECK (session ~ '^[0-9]{4}/[0-9]{4}$'),
    semester      smallint NOT NULL CHECK (semester IN (1, 2)),
    gpa           numeric(3,2) NOT NULL CHECK (gpa  >= 0 AND gpa  <= 5),
    cgpa          numeric(3,2) NOT NULL CHECK (cgpa >= 0 AND cgpa <= 5),
    -- The round it was collected in. NULL for a backfilled semester.
    round_id      uuid REFERENCES public.academic_rounds(id) ON DELETE SET NULL,
    -- Who wrote it: the member through the round link, or the coordinator correcting it.
    source        text NOT NULL DEFAULT 'member' CHECK (source IN ('member', 'coordinator')),
    submitted_at  timestamp with time zone NOT NULL DEFAULT now(),
    updated_at    timestamp with time zone NOT NULL DEFAULT now(),
    updated_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    UNIQUE (profile_id, session, semester)
);

COMMENT ON TABLE public.academic_records IS
    'A member''s GPA and CGPA for one semester (5-point scale). Self-reported through a round, or entered by the Academic Unit.';

CREATE INDEX IF NOT EXISTS academic_records_semester_idx
    ON public.academic_records (session, semester);

DROP TRIGGER IF EXISTS academic_records_set_updated_at ON public.academic_records;
CREATE TRIGGER academic_records_set_updated_at BEFORE UPDATE ON public.academic_records
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Who may see INDIVIDUAL results outside the module. Decided by whoever can write to
-- Academics, not by the System Admin. A single row; the app falls back to these
-- defaults if it is missing.
CREATE TABLE IF NOT EXISTS public.academic_settings (
    id                            boolean PRIMARY KEY DEFAULT true CHECK (id),
    unit_heads_see_individuals    boolean NOT NULL DEFAULT true,
    level_coords_see_individuals  boolean NOT NULL DEFAULT false,
    members_see_own               boolean NOT NULL DEFAULT false,
    updated_by                    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at                    timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.academic_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS academic_settings_set_updated_at ON public.academic_settings;
CREATE TRIGGER academic_settings_set_updated_at BEFORE UPDATE ON public.academic_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- The round page identifies members without a login, so every failed attempt is
-- logged and rate-limited. Same shape as lo_member_verify_attempts.
CREATE TABLE IF NOT EXISTS public.academic_submit_attempts (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_hash  text NOT NULL,
    identifier   text,
    succeeded    boolean NOT NULL DEFAULT false,
    created_at   timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academic_submit_attempts_client_idx
    ON public.academic_submit_attempts (client_hash, created_at DESC);

ALTER TABLE public.academic_rounds          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_rounds          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.academic_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_records         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.academic_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_settings        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.academic_submit_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_submit_attempts FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. module_access: the `academics` module
-- ----------------------------------------------------------------------------
ALTER TABLE public.module_access DROP CONSTRAINT IF EXISTS module_access_module_check;
ALTER TABLE public.module_access ADD CONSTRAINT module_access_module_check
    CHECK (module = ANY (ARRAY['tenure', 'zones', 'workforce', 'level', 'academics']));

INSERT INTO public.module_access (module, read_slugs, write_slugs, write_scope)
VALUES ('academics', ARRAY['EXCO:academic'], ARRAY['EXCO:academic'], 'ALL')
ON CONFLICT (module) DO NOTHING;

COMMIT;
