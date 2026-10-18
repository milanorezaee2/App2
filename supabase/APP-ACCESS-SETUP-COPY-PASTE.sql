-- Manager-only per-account app access controls.
-- This setup does not create app-update or release-policy functions.
BEGIN;

CREATE TABLE IF NOT EXISTS public.app_user_access_controls (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked boolean NOT NULL DEFAULT false,
  reason text CHECK (reason IS NULL OR length(reason) <= 240),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_user_access_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_user_access_controls FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_app_access()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'blocked', COALESCE(c.blocked, false),
    'reason', c.reason
  )
  FROM (SELECT auth.uid() AS user_id) caller
  LEFT JOIN public.app_user_access_controls c ON c.user_id = caller.user_id;
$$;
REVOKE ALL ON FUNCTION public.current_app_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_access() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_app_user_access(
  p_user_id uuid,
  p_blocked boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_education_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  IF p_user_id IS NULL OR p_blocked IS NULL THEN RAISE EXCEPTION 'ACCESS_INPUT_INVALID'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'SELF_ACCESS_CONTROL_FORBIDDEN'; END IF;
  IF EXISTS (SELECT 1 FROM public.education_admins a WHERE a.user_id = p_user_id) THEN
    RAISE EXCEPTION 'ADMIN_ACCESS_CONTROL_FORBIDDEN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_user_profiles p WHERE p.user_id = p_user_id) THEN
    RAISE EXCEPTION 'REGISTERED_USER_NOT_FOUND';
  END IF;

  INSERT INTO public.app_user_access_controls(user_id, blocked, reason, updated_by, updated_at)
  VALUES (p_user_id, p_blocked, CASE WHEN p_blocked THEN NULLIF(btrim(p_reason), '') ELSE NULL END, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    blocked = EXCLUDED.blocked,
    reason = EXCLUDED.reason,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_app_user_access(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_app_user_access(uuid, boolean, text) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_registered_users();
CREATE FUNCTION public.admin_registered_users()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text,
  platform text,
  app_version text,
  registered_at timestamptz,
  last_seen_at timestamptz,
  access_blocked boolean,
  access_reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_education_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  RETURN QUERY
  SELECT p.user_id, p.full_name, p.email, p.platform, p.app_version,
         p.registered_at, p.last_seen_at,
         COALESCE(c.blocked, false), c.reason
  FROM public.app_user_profiles p
  LEFT JOIN public.app_user_access_controls c ON c.user_id = p.user_id
  ORDER BY p.registered_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_registered_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_registered_users() TO authenticated;

COMMIT;
