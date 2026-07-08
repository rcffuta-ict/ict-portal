-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.class_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entry_year integer NOT NULL UNIQUE,
  family_name text,
  CONSTRAINT class_sets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.residential_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  CONSTRAINT residential_zones_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
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
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_residential_zone_id_fkey FOREIGN KEY (residential_zone_id) REFERENCES public.residential_zones(id),
  CONSTRAINT profiles_class_set_id_fkey FOREIGN KEY (class_set_id) REFERENCES public.class_sets(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  date date DEFAULT CURRENT_DATE,
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
  phone_number text NOT NULL,
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
  raffle_id integer UNIQUE,
  CONSTRAINT event_registrations_pkey PRIMARY KEY (id),
  CONSTRAINT event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT verification_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tenures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  session text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tenures_pkey PRIMARY KEY (id)
);
CREATE TABLE public.units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type = ANY (ARRAY['UNIT'::text, 'TEAM'::text])),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT units_pkey PRIMARY KEY (id)
);
CREATE TABLE public.leadership (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenure_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  unit_id uuid,
  can_manage_unit boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  class_set_id uuid,
  position_id uuid NOT NULL,
  residential_zone_id uuid,
  CONSTRAINT leadership_pkey PRIMARY KEY (id),
  CONSTRAINT leadership_tenure_id_fkey FOREIGN KEY (tenure_id) REFERENCES public.tenures(id),
  CONSTRAINT leadership_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT leadership_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT leadership_class_set_id_fkey FOREIGN KEY (class_set_id) REFERENCES public.class_sets(id),
  CONSTRAINT leadership_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.leadership_positions(id),
  CONSTRAINT leadership_residential_zone_id_fkey FOREIGN KEY (residential_zone_id) REFERENCES public.residential_zones(id)
);
CREATE TABLE public.leadership_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category = ANY (ARRAY['PRESIDENT'::text, 'CENTRAL'::text, 'UNIT'::text, 'TEAM'::text, 'LEVEL'::text, 'ZONE'::text])),
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
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
  CONSTRAINT event_questions_parent_question_id_fkey FOREIGN KEY (parent_question_id) REFERENCES public.event_questions(id),
  CONSTRAINT event_questions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_questions_asked_by_profile_id_fkey FOREIGN KEY (asked_by_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT event_questions_answered_by_profile_id_fkey FOREIGN KEY (answered_by_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.question_flags (
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
CREATE TABLE public.question_references (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  main_question_id uuid NOT NULL,
  referenced_question_id uuid NOT NULL,
  reference_type text DEFAULT 'related'::text CHECK (reference_type = ANY (ARRAY['duplicate'::text, 'related'::text, 'follow_up'::text, 'clarification'::text])),
  note text,
  linked_by_profile_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT question_references_pkey PRIMARY KEY (id),
  CONSTRAINT question_references_main_question_id_fkey FOREIGN KEY (main_question_id) REFERENCES public.event_questions(id),
  CONSTRAINT question_references_referenced_question_id_fkey FOREIGN KEY (referenced_question_id) REFERENCES public.event_questions(id),
  CONSTRAINT question_references_linked_by_profile_id_fkey FOREIGN KEY (linked_by_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.question_stars (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  profile_id uuid,
  session_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT question_stars_pkey PRIMARY KEY (id),
  CONSTRAINT question_stars_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.event_questions(id),
  CONSTRAINT question_stars_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
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
CREATE TABLE public.rw_settings (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  bank_name text NOT NULL DEFAULT 'First Bank'::text,
  bank_account_name text NOT NULL DEFAULT 'RCF FUTA'::text,
  bank_account_number text NOT NULL DEFAULT '3012345678'::text,
  payment_min_amount integer NOT NULL DEFAULT 2000,
  payment_installment_allowed boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  preorders_enabled boolean NOT NULL DEFAULT true,
  payments_enabled boolean NOT NULL DEFAULT true,
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
CREATE TABLE public.rw_verdicts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  verdict_ref text NOT NULL DEFAULT generate_verdict_ref() UNIQUE,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'ready'::text, 'archived'::text])),
  pdf_cloudinary_url text,
  pdf_cloudinary_id text,
  total_amount integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  fulfilled_at timestamp with time zone,
  fulfilled_by_profile_id uuid,
  fulfilled_by_name text,
  fulfilled_by_email text,
  note text,
  manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_units integer NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  issued_by_profile_id uuid,
  issued_by_name text,
  issued_by_email text,
  CONSTRAINT rw_verdicts_pkey PRIMARY KEY (id),
  CONSTRAINT rw_verdicts_fulfilled_by_profile_id_fkey FOREIGN KEY (fulfilled_by_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT rw_verdicts_issued_by_profile_id_fkey FOREIGN KEY (issued_by_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.rw_verdict_orders (
  verdict_id uuid NOT NULL,
  order_id uuid NOT NULL UNIQUE,
  order_ref text,
  customer_name text,
  customer_email text,
  total_amount integer NOT NULL DEFAULT 0,
  CONSTRAINT rw_verdict_orders_pkey PRIMARY KEY (verdict_id, order_id),
  CONSTRAINT rw_verdict_orders_verdict_id_fkey FOREIGN KEY (verdict_id) REFERENCES public.rw_verdicts(id),
  CONSTRAINT rw_verdict_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.rw_orders(id)
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
  department text,
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
CREATE TABLE public.fyb_pairings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  finalist_registration_id uuid NOT NULL,
  partner_registration_id uuid,
  partner_name text,
  partner_email text,
  partner_phone text,
  partner_gender text CHECK (partner_gender = ANY (ARRAY['male'::text, 'female'::text])),
  partner_photo_url text,
  pair_token text UNIQUE,
  amount integer NOT NULL DEFAULT 6000,
  paid boolean NOT NULL DEFAULT false,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fyb_pairings_pkey PRIMARY KEY (id),
  CONSTRAINT fyb_pairings_finalist_registration_id_fkey FOREIGN KEY (finalist_registration_id) REFERENCES public.fyb_registrations(id),
  CONSTRAINT fyb_pairings_partner_registration_id_fkey FOREIGN KEY (partner_registration_id) REFERENCES public.fyb_registrations(id),
  CONSTRAINT fyb_pairings_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.profiles(id)
);
