-- ============================================================================
-- Testimony cycle settings: Sunday reading cut-off time and overrides.
--
-- Supports filtering testimonies into Sunday reading cycles (Monday-Sunday)
-- with a default cut-off of 9:00 AM WAT and on-the-fly override capability
-- for the General Secretary and Lo! administrators.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.testimony_settings (
    id                            boolean PRIMARY KEY DEFAULT true CHECK (id),
    cutoff_time                   text NOT NULL DEFAULT '09:00',
    current_override_cutoff       timestamp with time zone,
    updated_by                    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at                    timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.testimony_settings IS
    'Sunday reading cycle cut-off settings for testimonies. Singleton row (id = true).';

INSERT INTO public.testimony_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS testimony_settings_set_updated_at ON public.testimony_settings;
CREATE TRIGGER testimony_settings_set_updated_at BEFORE UPDATE ON public.testimony_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.testimony_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimony_settings FORCE ROW LEVEL SECURITY;

COMMIT;
