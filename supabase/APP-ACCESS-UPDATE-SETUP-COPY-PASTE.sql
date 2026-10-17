-- Manager-only per-account app access control and signed Android release policies.
-- Public clients can read only an enabled release policy and their own access state.
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

CREATE TABLE IF NOT EXISTS public.app_release_policies (
  package_name text PRIMARY KEY CHECK (package_name IN (
    'com.devicecontrol.companion',
    'com.devicecontrol.milomultilang',
    'com.devicecontrol.miloadmin',
    'com.devicecontrol.milorussian'
  )),
  latest_version text NOT NULL CHECK (latest_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  minimum_version text NOT NULL CHECK (minimum_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  apk_url text NOT NULL CHECK (apk_url ~ '^https://github\.com/milanorezaee2/App2/releases/download/[^/]+/[^/]+\.apk$'),
  release_notes text NOT NULL DEFAULT '' CHECK (length(release_notes) <= 500),
  force_update boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (string_to_array(minimum_version, '.')::integer[] <= string_to_array(latest_version, '.')::integer[]),
  CHECK (NOT force_update OR enabled)
);
ALTER TABLE public.app_release_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_release_policies FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_app_release_policy(p_package_name text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'package_name', p.package_name,
    'latest_version', p.latest_version,
    'minimum_version', p.minimum_version,
    'apk_url', p.apk_url,
    'release_notes', p.release_notes,
    'force_update', p.force_update,
    'enabled', p.enabled,
    'updated_at', p.updated_at
  )
  FROM public.app_release_policies p
  WHERE p.package_name = p_package_name AND p.enabled = true;
$$;
REVOKE ALL ON FUNCTION public.public_app_release_policy(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_app_release_policy(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_app_release_policies()
RETURNS TABLE(
  package_name text,
  latest_version text,
  minimum_version text,
  apk_url text,
  release_notes text,
  force_update boolean,
  enabled boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_education_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  RETURN QUERY
  SELECT target.package_name, policy.latest_version, policy.minimum_version,
         policy.apk_url, policy.release_notes, policy.force_update,
         COALESCE(policy.enabled, false), policy.updated_at
  FROM (VALUES
    ('com.devicecontrol.companion'::text),
    ('com.devicecontrol.milomultilang'::text),
    ('com.devicecontrol.miloadmin'::text),
    ('com.devicecontrol.milorussian'::text)
  ) AS target(package_name)
  LEFT JOIN public.app_release_policies policy USING (package_name)
  ORDER BY target.package_name;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_app_release_policies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_app_release_policies() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_app_release_policy(
  p_package_name text,
  p_latest_version text,
  p_minimum_version text,
  p_apk_url text,
  p_release_notes text DEFAULT '',
  p_force_update boolean DEFAULT false,
  p_enabled boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE expected_apk text;
BEGIN
  IF NOT public.is_education_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  expected_apk := CASE p_package_name
    WHEN 'com.devicecontrol.companion' THEN 'MiloMultilang.apk'
    WHEN 'com.devicecontrol.milomultilang' THEN 'MiloMultilang-Login.apk'
    WHEN 'com.devicecontrol.miloadmin' THEN 'MiloAdmin.apk'
    WHEN 'com.devicecontrol.milorussian' THEN 'MiloRussian.apk'
    ELSE NULL
  END;
  IF expected_apk IS NULL THEN RAISE EXCEPTION 'APP_PACKAGE_INVALID'; END IF;
  IF p_latest_version IS NULL OR p_latest_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$'
     OR p_minimum_version IS NULL OR p_minimum_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' THEN
    RAISE EXCEPTION 'APP_VERSION_INVALID';
  END IF;
  IF string_to_array(p_minimum_version, '.')::integer[] > string_to_array(p_latest_version, '.')::integer[] THEN
    RAISE EXCEPTION 'MINIMUM_VERSION_EXCEEDS_LATEST';
  END IF;
  IF p_apk_url IS NULL OR p_apk_url !~ ('^https://github\.com/milanorezaee2/App2/releases/download/[^/]+/' || expected_apk || '$') THEN
    RAISE EXCEPTION 'APK_URL_INVALID';
  END IF;
  IF p_force_update AND (NOT p_enabled OR p_apk_url IS NULL) THEN RAISE EXCEPTION 'FORCE_UPDATE_NEEDS_RELEASE'; END IF;
  IF coalesce(length(p_release_notes), 0) > 500 THEN RAISE EXCEPTION 'RELEASE_NOTES_TOO_LONG'; END IF;

  INSERT INTO public.app_release_policies(
    package_name, latest_version, minimum_version, apk_url,
    release_notes, force_update, enabled, updated_by, updated_at
  ) VALUES (
    p_package_name, p_latest_version, p_minimum_version, p_apk_url,
    coalesce(p_release_notes, ''), p_force_update, p_enabled, auth.uid(), now()
  )
  ON CONFLICT (package_name) DO UPDATE SET
    latest_version = EXCLUDED.latest_version,
    minimum_version = EXCLUDED.minimum_version,
    apk_url = EXCLUDED.apk_url,
    release_notes = EXCLUDED.release_notes,
    force_update = EXCLUDED.force_update,
    enabled = EXCLUDED.enabled,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_save_app_release_policy(text, text, text, text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_app_release_policy(text, text, text, text, text, boolean, boolean) TO authenticated;

COMMIT;
