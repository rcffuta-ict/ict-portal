-- ============================================================================
-- Migration 0003 — Set-password-on-first-login.
--
-- Depends on 0001. Apply after 0001/0002.
--
-- Model change: appointing a leader creates a `profile_login` row with NO
-- password. `password_hash IS NULL` means "not set yet" — the leader sets it on
-- their first login (email → set password + confirm). A VP Admin / ICT Coordinator
-- "reset" simply nulls the hash again, sending the leader back through that step.
-- ============================================================================

BEGIN;

-- Password is now optional: NULL = not set (must be set on first login).
ALTER TABLE public.profile_login ALTER COLUMN password_hash DROP NOT NULL;

-- Retire any placeholder hashes written by the earlier "unusable hash" approach,
-- so those leaders fall into the set-password-on-first-login path.
UPDATE public.profile_login
SET password_hash = NULL
WHERE password_hash = 'disabled$no-password-set';

COMMIT;
