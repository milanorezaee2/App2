-- Disable the retired in-app update controls without disturbing account access.
-- Keep the read-only policy endpoint and disabled rows so older installed builds
-- can refresh and clear any cached force-update policy.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.app_release_policies') IS NOT NULL THEN
    UPDATE public.app_release_policies
    SET enabled = false,
        force_update = false,
        updated_at = now()
    WHERE enabled = true OR force_update = true;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_save_app_release_policy(text, text, text, text, text, boolean, boolean);
DROP FUNCTION IF EXISTS public.admin_app_release_policies();

COMMIT;
