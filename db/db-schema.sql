-- ============================================================================
-- REFERENCE SCHEMA — for reading, not for running.
--
-- PROVENANCE, because the last version of this file was badly misleading:
--   Dumped from the live Supabase project, then edited to apply migration 0013.
--   The previous file was a dump taken BEFORE migration 0001 with 0009-0012 hand-
--   appended on top. It still declared `profiles.id REFERENCES auth.users(id)` — which
--   0001 explicitly drops — and was missing twelve tables the database actually has,
--   while containing `fyb_pairings`, which it no longer does. Anyone reading it to
--   understand the schema got the pre-auth-rework design.
--
-- KEEPING IT HONEST: re-dump from Supabase after applying a migration. Do not hand-
-- append tables to it — that is exactly how it drifted the first time.
--
-- WHOSE TABLES ARE THESE? At least five applications share this `public` schema:
--   (portal)  everything not listed below — see PORTAL_TABLES in scripts/db-inventory.mjs
--   rw_*      ReadWrite store
--   fyb_*     Final Year Brethren
--   elib_*    E-library
--   game_* / trivia_* / bingo_* / buzzer_*   a games & engagement app
--   categories  an orphan with rw_categories' exact shape, referenced nowhere.
--               Owner unconfirmed — do not drop it on a guess.
--
-- Run `node scripts/db-inventory.mjs` for live row counts grouped this way.
--
-- Schema state: migrations 0001-0013 applied.
-- ============================================================================

CREATE TABLE public.schema_migrations ( -- migration 0013
  id text NOT NULL,
  version text NOT NULL,
  name text NOT NULL,
  applied_at timestamp with time zone DEFAULT now(),
  applied_by text,
  notes text,
  CONSTRAINT schema_migrations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.class_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entry_year integer NOT NULL UNIQUE,
  family_name text,
  is_foundation boolean NOT NULL DEFAULT false,
  level_override text,
  CONSTRAINT class_sets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.residential_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  CONSTRAINT residential_zones_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  middle_name text,
  gender text CHECK (gender = ANY (ARRAY['male'::text, 'female'::text])),
  dob date,
  phone_number text,
  matric_number text UNIQUE,
  department text,
  faculty text,
  entry_year integer,
  school_address text,
  home_address text,
  residential_zone_id uuid,
  next_of_kin_name text,
  next_of_kin_phone text,
  parent_phone text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  avatar_url text,
  class_set_id uuid,
  email text UNIQUE,
  avatar_public_id text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_residential_zone_id_fkey FOREIGN KEY (residential_zone_id) REFERENCES public.residential_zones(id),
  CONSTRAINT profiles_class_set_id_fkey FOREIGN KEY (class_set_id) REFERENCES public.class_sets(id)
);
CREATE TABLE public.tenures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  session text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  theme text,
  CONSTRAINT tenures_pkey PRIMARY KEY (id)
);
CREATE TABLE public.units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type = ANY (ARRAY['UNIT'::text, 'TEAM'::text])),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  is_workforce boolean NOT NULL DEFAULT true,
  slug text NOT NULL,
  CONSTRAINT units_pkey PRIMARY KEY (id)
);
CREATE TABLE public.leadership (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenure_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  unit_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  class_set_id uuid,
  position_id uuid NOT NULL,
  residential_zone_id uuid,
  is_lead boolean NOT NULL DEFAULT true,
  CONSTRAINT leadership_pkey PRIMARY KEY (id),
  CONSTRAINT leadership_tenure_id_fkey FOREIGN KEY (tenure_id) REFERENCES public.tenures(id),
  CONSTRAINT leadership_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT leadership_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT leadership_class_set_id_fkey FOREIGN KEY (class_set_id) REFERENCES public.class_sets(id),
  CONSTRAINT leadership_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.leadership_positions(id),
  CONSTRAINT leadership_residential_zone_id_fkey FOREIGN KEY (residential_zone_id) REFERENCES public.residential_zones(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  date timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  config jsonb DEFAULT '{"max_shopping_items": 2}'::jsonb,
  is_recurring boolean DEFAULT false,
  is_exclusive boolean DEFAULT false,
  CONSTRAINT events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.event_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone_number text,
  level text,
  checked_in_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  email text,
  gender text,
  relationship_status text,
  referral_source text,
  questions_content text,
  is_rcf_member boolean DEFAULT false,
  coupon_code text,
  coupon_active boolean DEFAULT false,
  coupon_used_at timestamp with time zone,
  department text,
  matric_number text,
  CONSTRAINT event_registrations_pkey PRIMARY KEY (id),
  CONSTRAINT event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.leadership_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  alias text,
  slug text NOT NULL,
  tier text CHECK (tier IS NULL OR (tier = ANY (ARRAY['PRESIDENT'::text, 'VP'::text, 'EXECUTIVE'::text, 'COORDINATOR'::text]))),
  is_protected boolean NOT NULL DEFAULT false,
  CONSTRAINT leadership_positions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.membership_units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  tenure_id uuid NOT NULL,
  role text DEFAULT 'Member'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT membership_units_pkey PRIMARY KEY (id),
  CONSTRAINT membership_units_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT membership_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT membership_units_tenure_id_fkey FOREIGN KEY (tenure_id) REFERENCES public.tenures(id)
);
CREATE TABLE public.elib_courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  department text NOT NULL,
  level integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT elib_courses_pkey PRIMARY KEY (id)
);
CREATE TABLE public.elib_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  title text NOT NULL,
  type USER-DEFINED DEFAULT 'PQ'::material_type,
  year text,
  semester USER-DEFINED,
  file_path text NOT NULL,
  file_size integer DEFAULT 0,
  downloads integer DEFAULT 0,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT elib_materials_pkey PRIMARY KEY (id),
  CONSTRAINT elib_materials_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.elib_courses(id),
  CONSTRAINT elib_materials_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.elib_downloads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  material_id uuid,
  downloaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT elib_downloads_pkey PRIMARY KEY (id),
  CONSTRAINT elib_downloads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT elib_downloads_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.elib_materials(id)
);
CREATE TABLE public.unit_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  position_id uuid NOT NULL,
  role_type USER-DEFINED NOT NULL DEFAULT 'assistant'::unit_role_type,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unit_positions_pkey PRIMARY KEY (id),
  CONSTRAINT unit_positions_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT unit_positions_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.leadership_positions(id)
);
CREATE TABLE public.question_flags ( -- KEPT: event_questions_with_details depends on it
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  reason USER-DEFINED NOT NULL,
  description text,
  flagged_by_profile_id uuid,
  flagged_by_name text,
  resolved_by_profile_id uuid,
  resolved_at timestamp with time zone,
  resolution_note text,
  created_at timestamp with time zone DEFAULT now(),
  is_resolved boolean DEFAULT false,
  CONSTRAINT question_flags_pkey PRIMARY KEY (id),
  CONSTRAINT question_flags_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.event_questions(id),
  CONSTRAINT question_flags_flagged_by_profile_id_fkey FOREIGN KEY (flagged_by_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT question_flags_resolved_by_profile_id_fkey FOREIGN KEY (resolved_by_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.question_stars (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  profile_id uuid,
  session_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT question_stars_pkey PRIMARY KEY (id),
  CONSTRAINT question_stars_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.event_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  question_text text NOT NULL,
  scripture_reference text,
  asked_by_profile_id uuid,
  asker_name text,
  answer_text text,
  answered_by_profile_id uuid,
  answered_at timestamp with time zone,
  status USER-DEFINED DEFAULT 'visible'::question_status,
  is_pinned boolean DEFAULT false,
  cluster_id uuid,
  parent_question_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  search_vector tsvector DEFAULT to_tsvector('english'::regconfig, ((((question_text || ' '::text) || COALESCE(scripture_reference, ''::text)) || ' '::text) || COALESCE(answer_text, ''::text))),
  CONSTRAINT event_questions_pkey PRIMARY KEY (id),
  CONSTRAINT event_questions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_questions_asked_by_profile_id_fkey FOREIGN KEY (asked_by_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT event_questions_answered_by_profile_id_fkey FOREIGN KEY (answered_by_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT event_questions_parent_question_id_fkey FOREIGN KEY (parent_question_id) REFERENCES public.event_questions(id)
);
CREATE TABLE public.rw_admin_moderators (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['ADMIN'::text, 'MODERATOR'::text])),
  added_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rw_admin_moderators_pkey PRIMARY KEY (id),
  CONSTRAINT rw_admin_moderators_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT rw_admin_moderators_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.rw_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rw_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.rw_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  base_price integer NOT NULL CHECK (base_price >= 0),
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  post_order_price integer CHECK (post_order_price >= 0),
  CONSTRAINT rw_products_pkey PRIMARY KEY (id),
  CONSTRAINT rw_products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.rw_categories(id)
);
CREATE TABLE public.rw_product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  size text,
  color text,
  color_hex text,
  design text,
  sku text,
  price_override integer,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  post_order_price_override integer,
  CONSTRAINT rw_product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT rw_product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.rw_products(id)
);
CREATE TABLE public.rw_product_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL,
  cloudinary_public_id text NOT NULL UNIQUE,
  cloudinary_url text NOT NULL,
  alt_text text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rw_product_images_pkey PRIMARY KEY (id),
  CONSTRAINT rw_product_images_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.rw_product_variants(id)
);
CREATE TABLE public.rw_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_ref text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  customer_note text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::order_status,
  total_amount integer NOT NULL CHECK (total_amount > 0),
  amount_paid integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  follow_up_count integer NOT NULL DEFAULT 0,
  last_follow_up_at timestamp with time zone,
  pickup_token text,
  delivered_at timestamp with time zone,
  delivered_by_name text,
  delivered_by_email text,
  CONSTRAINT rw_orders_pkey PRIMARY KEY (id)
);
CREATE TABLE public.rw_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  product_name text NOT NULL,
  variant_label text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price integer NOT NULL CHECK (unit_price >= 0),
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rw_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT rw_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.rw_orders(id),
  CONSTRAINT rw_order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.rw_product_variants(id)
);
CREATE TABLE public.rw_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  cloudinary_receipt_public_id text UNIQUE,
  receipt_url text,
  extracted_amount integer NOT NULL CHECK (extracted_amount > 0),
  extracted_sender_name text,
  extracted_date date,
  extracted_time text,
  extracted_bank text,
  extracted_transaction_ref text,
  extraction_confidence USER-DEFINED,
  user_confirmed_accuracy boolean,
  amount_confirmed integer CHECK (amount_confirmed >= 0),
  status USER-DEFINED NOT NULL DEFAULT 'pending'::payment_status,
  review_note text,
  moderator_name text,
  moderator_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rw_payments_pkey PRIMARY KEY (id),
  CONSTRAINT rw_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.rw_orders(id)
);
CREATE TABLE public.rw_settings (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  bank_name text NOT NULL DEFAULT 'First Bank'::text,
  bank_account_name text NOT NULL DEFAULT 'RCF FUTA'::text,
  bank_account_number text NOT NULL DEFAULT '3012345678'::text,
  payment_min_amount integer NOT NULL DEFAULT 5000,
  payment_installment_allowed boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  preorders_enabled boolean NOT NULL DEFAULT true,
  payments_enabled boolean NOT NULL DEFAULT true,
  order_phase text NOT NULL DEFAULT 'preorder'::text CHECK (order_phase = ANY (ARRAY['preorder'::text, 'postorder'::text])),
  pickup_token_required boolean NOT NULL DEFAULT true,
  CONSTRAINT rw_settings_pkey PRIMARY KEY (id),
  CONSTRAINT rw_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.rw_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rw_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT rw_audit_logs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.rw_email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  label text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT rw_email_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.rw_email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  payment_id uuid,
  template_key text NOT NULL,
  recipient_email text NOT NULL,
  subject text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rw_email_logs_pkey PRIMARY KEY (id),
  CONSTRAINT rw_email_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.rw_orders(id),
  CONSTRAINT rw_email_logs_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.rw_payments(id)
);
CREATE TABLE public.rw_email_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  mode text NOT NULL DEFAULT 'status'::text,
  event_type text,
  order_id uuid,
  payment_id uuid,
  new_status text,
  template_key text,
  recipient_email text,
  subject text,
  body_html text,
  status text NOT NULL DEFAULT 'pending'::text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  sent_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  order_ids jsonb,
  CONSTRAINT rw_email_queue_pkey PRIMARY KEY (id),
  CONSTRAINT rw_email_queue_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.rw_orders(id),
  CONSTRAINT rw_email_queue_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.rw_payments(id)
);
CREATE TABLE public.fyb_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone_number text,
  gender text CHECK (gender = ANY (ARRAY['male'::text, 'female'::text])),
  level text NOT NULL,
  entry_year integer,
  unit text,
  photo_url text NOT NULL,
  photo_public_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fyb_registrations_pkey PRIMARY KEY (id),
  CONSTRAINT fyb_registrations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.fyb_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'ADMIN'::text CHECK (role = ANY (ARRAY['ADMIN'::text, 'MODERATOR'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fyb_admins_pkey PRIMARY KEY (id),
  CONSTRAINT fyb_admins_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.rw_verdicts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  verdict_ref text NOT NULL DEFAULT generate_verdict_ref() UNIQUE,
  status USER-DEFINED NOT NULL DEFAULT 'active'::verdict_status,
  issued_by_profile_id uuid,
  issued_by_name text NOT NULL,
  issued_by_email text NOT NULL,
  note text,
  manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount integer NOT NULL DEFAULT 0,
  total_units integer NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  fulfilled_at timestamp with time zone,
  fulfilled_by_profile_id uuid,
  fulfilled_by_name text,
  fulfilled_by_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rw_verdicts_pkey PRIMARY KEY (id),
  CONSTRAINT rw_verdicts_issued_by_profile_id_fkey FOREIGN KEY (issued_by_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT rw_verdicts_fulfilled_by_profile_id_fkey FOREIGN KEY (fulfilled_by_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.rw_verdict_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  verdict_id uuid NOT NULL,
  order_id uuid NOT NULL UNIQUE,
  order_ref text NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  total_amount integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rw_verdict_orders_pkey PRIMARY KEY (id),
  CONSTRAINT rw_verdict_orders_verdict_id_fkey FOREIGN KEY (verdict_id) REFERENCES public.rw_verdicts(id),
  CONSTRAINT rw_verdict_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.rw_orders(id)
);
CREATE TABLE public.profile_login (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  password_hash text,
  is_active boolean NOT NULL DEFAULT true,
  granted_by uuid,
  last_login_at timestamp with time zone,
  last_login_ip text,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profile_login_pkey PRIMARY KEY (id),
  CONSTRAINT profile_login_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT profile_login_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.auth_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  ip text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  revoked_reason text,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT auth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT auth_sessions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.login_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  email text,
  event text NOT NULL CHECK (event = ANY (ARRAY['login_success'::text, 'login_fail'::text, 'logout'::text, 'session_revoked'::text])),
  ip text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT login_events_pkey PRIMARY KEY (id),
  CONSTRAINT login_events_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.zone_pastors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  zone_id uuid NOT NULL,
  tenure_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT zone_pastors_pkey PRIMARY KEY (id),
  CONSTRAINT zone_pastors_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT zone_pastors_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.residential_zones(id),
  CONSTRAINT zone_pastors_tenure_id_fkey FOREIGN KEY (tenure_id) REFERENCES public.tenures(id)
);
CREATE TABLE public.registration_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  class_set_id uuid,
  purpose text NOT NULL DEFAULT 'create'::text CHECK (purpose = ANY (ARRAY['create'::text, 'update'::text, 'reset'::text, 'level'::text])),
  target_profile_id uuid,
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  use_count integer NOT NULL DEFAULT 0,
  max_uses integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  label text,
  CONSTRAINT registration_invites_pkey PRIMARY KEY (id),
  CONSTRAINT registration_invites_class_set_id_fkey FOREIGN KEY (class_set_id) REFERENCES public.class_sets(id),
  CONSTRAINT registration_invites_target_profile_id_fkey FOREIGN KEY (target_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT registration_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.module_access (
  module text NOT NULL CHECK (module = ANY (ARRAY['tenure'::text, 'zones'::text, 'workforce'::text, 'level'::text])),
  read_slugs ARRAY NOT NULL DEFAULT '{}'::text[],
  write_slugs ARRAY NOT NULL DEFAULT '{}'::text[],
  write_scope text NOT NULL DEFAULT 'ALL'::text CHECK (write_scope = ANY (ARRAY['ALL'::text, 'OWN'::text])),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT module_access_pkey PRIMARY KEY (module),
  CONSTRAINT module_access_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.position_privileges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL,
  privilege text NOT NULL CHECK (privilege = ANY (ARRAY['EXCO'::text, 'ZONE'::text, 'LEVEL'::text, 'CENTRAL'::text, 'PRESIDENT'::text, 'SYSADMIN'::text])),
  scope text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT position_privileges_pkey PRIMARY KEY (id),
  CONSTRAINT position_privileges_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.leadership_positions(id)
);
CREATE TABLE public.rw_sponsor_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sponsor_slug text NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  whatsapp text,
  skill text,
  signed_up boolean NOT NULL DEFAULT false,
  auto_included boolean NOT NULL DEFAULT false,
  opted_out boolean NOT NULL DEFAULT false,
  consent boolean NOT NULL DEFAULT false,
  consent_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rw_sponsor_leads_pkey PRIMARY KEY (id)
);
CREATE TABLE public.rw_sponsors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT ''::text,
  description text NOT NULL DEFAULT ''::text,
  url text NOT NULL DEFAULT ''::text,
  logo_url text NOT NULL DEFAULT ''::text,
  brand_color text NOT NULL DEFAULT '#1B4DF5'::text,
  courses jsonb NOT NULL DEFAULT '[]'::jsonb,
  collects_data boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rw_sponsors_pkey PRIMARY KEY (id)
);
CREATE TABLE public.invite_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['generated'::text, 'revoked'::text, 'register'::text, 'update'::text])),
  profile_id uuid,
  actor_name text,
  actor_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invite_events_pkey PRIMARY KEY (id),
  CONSTRAINT invite_events_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.registration_invites(id),
  CONSTRAINT invite_events_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.game_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'live'::text, 'ended'::text])),
  current_round_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT game_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT game_sessions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT game_sessions_current_round_fkey FOREIGN KEY (current_round_id) REFERENCES public.game_rounds(id)
);
CREATE TABLE public.game_rounds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['trivia'::text, 'buzzer'::text, 'bingo'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'locked'::text, 'revealed'::text, 'ended'::text])),
  order_index integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT game_rounds_pkey PRIMARY KEY (id),
  CONSTRAINT game_rounds_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id)
);
CREATE TABLE public.game_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT game_participants_pkey PRIMARY KEY (id),
  CONSTRAINT game_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id),
  CONSTRAINT game_participants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.trivia_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_index integer NOT NULL,
  points integer NOT NULL DEFAULT 100,
  order_index integer NOT NULL DEFAULT 0,
  CONSTRAINT trivia_questions_pkey PRIMARY KEY (id),
  CONSTRAINT trivia_questions_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.game_rounds(id)
);
CREATE TABLE public.trivia_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL,
  question_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  choice_index integer NOT NULL,
  answered_at timestamp with time zone NOT NULL DEFAULT now(),
  is_correct boolean NOT NULL DEFAULT false,
  points_awarded integer NOT NULL DEFAULT 0,
  CONSTRAINT trivia_answers_pkey PRIMARY KEY (id),
  CONSTRAINT trivia_answers_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.game_rounds(id),
  CONSTRAINT trivia_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.trivia_questions(id),
  CONSTRAINT trivia_answers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.bingo_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL,
  item_index integer NOT NULL,
  call_order integer NOT NULL,
  called_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bingo_calls_pkey PRIMARY KEY (id),
  CONSTRAINT bingo_calls_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.game_rounds(id)
);
CREATE TABLE public.bingo_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  layout jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bingo_cards_pkey PRIMARY KEY (id),
  CONSTRAINT bingo_cards_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.game_rounds(id),
  CONSTRAINT bingo_cards_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.bingo_marks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL,
  cell_index integer NOT NULL,
  marked_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bingo_marks_pkey PRIMARY KEY (id),
  CONSTRAINT bingo_marks_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.bingo_cards(id)
);
CREATE TABLE public.bingo_wins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  pattern text NOT NULL,
  position integer NOT NULL,
  points_awarded integer NOT NULL DEFAULT 0,
  claimed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bingo_wins_pkey PRIMARY KEY (id),
  CONSTRAINT bingo_wins_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.game_rounds(id),
  CONSTRAINT bingo_wins_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.buzzer_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL,
  prompt_text text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  opened_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buzzer_prompts_pkey PRIMARY KEY (id),
  CONSTRAINT buzzer_prompts_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.game_rounds(id)
);
CREATE TABLE public.buzzer_presses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  server_time timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  position integer NOT NULL,
  reaction_ms integer,
  points_awarded integer NOT NULL DEFAULT 0,
  CONSTRAINT buzzer_presses_pkey PRIMARY KEY (id),
  CONSTRAINT buzzer_presses_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.buzzer_prompts(id),
  CONSTRAINT buzzer_presses_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.fyb_consent_tokens (
  registration_id uuid NOT NULL,
  token text NOT NULL UNIQUE CHECK (token ~ '^FYB-[2-9A-HJ-NP-Z]{4}$'::text),
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  last_sent_at timestamp with time zone,
  CONSTRAINT fyb_consent_tokens_pkey PRIMARY KEY (registration_id),
  CONSTRAINT fyb_consent_tokens_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.fyb_registrations(id)
);
CREATE TABLE public.fyb_email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  label text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT fyb_email_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fyb_email_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  mode text NOT NULL DEFAULT 'template'::text,
  template_key text,
  subject text,
  body_html text,
  context_id uuid,
  context_ids jsonb,
  context_type text,
  recipient_email text,
  recipient_name text,
  status text NOT NULL DEFAULT 'pending'::text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  sent_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fyb_email_queue_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fyb_email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  queue_id uuid,
  context_id uuid,
  template_key text,
  recipient_email text NOT NULL,
  subject text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fyb_email_logs_pkey PRIMARY KEY (id),
  CONSTRAINT fyb_email_logs_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.fyb_email_queue(id)
);
CREATE TABLE public.fyb_pair_intents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['finalist'::text, 'associate'::text])),
  initiator_registration_id uuid NOT NULL,
  partner_registration_id uuid,
  associate_name text,
  associate_email text,
  associate_phone text,
  associate_gender text CHECK (associate_gender = ANY (ARRAY['male'::text, 'female'::text])),
  associate_relationship text,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'cancelled'::text])),
  approved_at timestamp with time zone,
  approved_by uuid,
  cancel_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  pair_low uuid DEFAULT LEAST(initiator_registration_id, partner_registration_id),
  pair_high uuid DEFAULT GREATEST(initiator_registration_id, partner_registration_id),
  CONSTRAINT fyb_pair_intents_pkey PRIMARY KEY (id),
  CONSTRAINT fyb_pair_intents_initiator_registration_id_fkey FOREIGN KEY (initiator_registration_id) REFERENCES public.fyb_registrations(id),
  CONSTRAINT fyb_pair_intents_partner_registration_id_fkey FOREIGN KEY (partner_registration_id) REFERENCES public.fyb_registrations(id),
  CONSTRAINT fyb_pair_intents_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.fyb_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT fyb_settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.fyb_token_attempts (
  id bigint NOT NULL DEFAULT nextval('fyb_token_attempts_id_seq'::regclass),
  ip text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fyb_token_attempts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fyb_award_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fyb_award_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fyb_award_candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  registration_id uuid,
  nickname text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  share_code text NOT NULL DEFAULT fyb_share_code(),
  entry_kind text NOT NULL DEFAULT 'individual'::text CHECK (entry_kind = ANY (ARRAY['individual'::text, 'clique'::text, 'brand'::text])),
  display_name text,
  logo_url text,
  CONSTRAINT fyb_award_candidates_pkey PRIMARY KEY (id),
  CONSTRAINT fyb_award_candidates_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.fyb_award_categories(id),
  CONSTRAINT fyb_award_candidates_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.fyb_registrations(id)
);
CREATE TABLE public.fyb_award_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  voter_profile_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fyb_award_votes_pkey PRIMARY KEY (id),
  CONSTRAINT fyb_award_votes_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.fyb_award_categories(id),
  CONSTRAINT fyb_award_votes_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.fyb_award_candidates(id),
  CONSTRAINT fyb_award_votes_voter_profile_id_fkey FOREIGN KEY (voter_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.testimonies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) >= 3 AND char_length(btrim(title)) <= 120),
  body text NOT NULL CHECK (char_length(btrim(body)) >= 20 AND char_length(btrim(body)) <= 5000),
  category text NOT NULL DEFAULT 'other'::text CHECK (category = ANY (ARRAY['healing'::text, 'provision'::text, 'academics'::text, 'salvation'::text, 'protection'::text, 'family'::text, 'answered_prayer'::text, 'other'::text])),
  scripture_reference text,
  author_profile_id uuid,
  author_name text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  event_id uuid,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'hidden'::text])),
  reviewed_by_profile_id uuid,
  reviewed_at timestamp with time zone,
  review_note text,
  published_at timestamp with time zone,
  share_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT testimonies_pkey PRIMARY KEY (id),
  CONSTRAINT testimonies_author_profile_id_fkey FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT testimonies_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT testimonies_reviewed_by_profile_id_fkey FOREIGN KEY (reviewed_by_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.testimony_amens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  testimony_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT testimony_amens_pkey PRIMARY KEY (id),
  CONSTRAINT testimony_amens_testimony_id_fkey FOREIGN KEY (testimony_id) REFERENCES public.testimonies(id),
  CONSTRAINT testimony_amens_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.lo_member_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  CONSTRAINT lo_member_links_pkey PRIMARY KEY (id),
  CONSTRAINT lo_member_links_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.lo_member_verify_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_hash text NOT NULL,
  identifier text,
  succeeded boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lo_member_verify_attempts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fyb_award_candidate_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  registration_id uuid NOT NULL,
  role text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fyb_award_candidate_members_pkey PRIMARY KEY (id),
  CONSTRAINT fyb_award_candidate_members_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.fyb_award_candidates(id),
  CONSTRAINT fyb_award_candidate_members_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.fyb_registrations(id)
);
CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_profile_id uuid NOT NULL,
  actor_name text,
  target_profile_id uuid,
  target_name text,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT admin_audit_log_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT admin_audit_log_target_profile_id_fkey FOREIGN KEY (target_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.unit_transfer_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  tenure_id uuid NOT NULL,
  from_unit_id uuid,
  to_unit_id uuid NOT NULL,
  requested_by uuid,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'cancelled'::text])),
  decided_by uuid,
  decided_at timestamp with time zone,
  decline_reason text,
  CONSTRAINT unit_transfer_requests_pkey PRIMARY KEY (id),
  CONSTRAINT unit_transfer_requests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT unit_transfer_requests_tenure_id_fkey FOREIGN KEY (tenure_id) REFERENCES public.tenures(id),
  CONSTRAINT unit_transfer_requests_from_unit_id_fkey FOREIGN KEY (from_unit_id) REFERENCES public.units(id),
  CONSTRAINT unit_transfer_requests_to_unit_id_fkey FOREIGN KEY (to_unit_id) REFERENCES public.units(id),
  CONSTRAINT unit_transfer_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id),
  CONSTRAINT unit_transfer_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.handover_intents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_tenure_id uuid,
  from_tenure_name text,
  from_tenure_session text,
  to_tenure_id uuid,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'in_progress'::text, 'completed'::text, 'abandoned'::text])),
  step smallint NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  initiated_by uuid,
  initiated_by_name text,
  completed_by uuid,
  completed_by_name text,
  completed_at timestamp with time zone,
  abandoned_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT handover_intents_pkey PRIMARY KEY (id),
  CONSTRAINT handover_intents_from_tenure_id_fkey FOREIGN KEY (from_tenure_id) REFERENCES public.tenures(id),
  CONSTRAINT handover_intents_to_tenure_id_fkey FOREIGN KEY (to_tenure_id) REFERENCES public.tenures(id),
  CONSTRAINT handover_intents_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.profiles(id),
  CONSTRAINT handover_intents_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.handover_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL,
  action text NOT NULL,
  detail text,
  actor_id uuid,
  actor_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT handover_events_pkey PRIMARY KEY (id),
  CONSTRAINT handover_events_intent_id_fkey FOREIGN KEY (intent_id) REFERENCES public.handover_intents(id),
  CONSTRAINT handover_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id)
);
