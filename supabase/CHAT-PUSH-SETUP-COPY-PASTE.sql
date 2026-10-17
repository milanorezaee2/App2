-- Dashboard SQL Editor copy/paste package for chat/support push notifications.
-- First run the existing base schema in supabase/SETUP-COPY-PASTE-ONCE.sql.
-- This file then applies the current education-admin, token, profile, support
-- chat, and offline queue migrations in dependency order.
-- Before Run: choose a unique long random value, uncomment the vault.create_secret
-- statement in migration 202610170001 below, and replace its placeholder. Use
-- the same value for CHAT_WEBHOOK_SECRET in Supabase Edge Function Secrets.
-- Never commit an actual secret to the repository.


-- ================= COPY FROM supabase/migrations/202610070001_education_admin.sql =================
-- Educational management only. No device, message, or contact policies are changed.
-- Prerequisite: learning_progress (SETUP-PRODUCTION.sql).
BEGIN;
CREATE TABLE IF NOT EXISTS public.education_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 80)
);
ALTER TABLE public.education_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.education_admins FROM anon, authenticated;
GRANT SELECT ON public.education_admins TO authenticated;
DROP POLICY IF EXISTS education_admin_self ON public.education_admins;
CREATE POLICY education_admin_self ON public.education_admins FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_education_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.education_admins WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_education_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_education_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.education_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 admin_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.education_admins(user_id) ON DELETE CASCADE,
 label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 80),
 code uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
 claimed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.education_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.education_invites FROM anon, authenticated;
GRANT SELECT, DELETE ON public.education_invites TO authenticated;
GRANT INSERT (label) ON public.education_invites TO authenticated;
DROP POLICY IF EXISTS education_invites_owner ON public.education_invites;
CREATE POLICY education_invites_owner ON public.education_invites FOR ALL TO authenticated
USING (admin_id = auth.uid() AND public.is_education_admin())
WITH CHECK (admin_id = auth.uid() AND public.is_education_admin());

CREATE TABLE IF NOT EXISTS public.education_enrollments (
 admin_id uuid NOT NULL REFERENCES public.education_admins(user_id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 80),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
 consent_version text NOT NULL DEFAULT 'education-v1',
 consent_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (admin_id, student_id),
 CHECK (admin_id <> student_id)
);
ALTER TABLE public.education_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.education_enrollments FROM anon, authenticated;
GRANT SELECT, DELETE ON public.education_enrollments TO authenticated;
GRANT UPDATE (status) ON public.education_enrollments TO authenticated;
DROP POLICY IF EXISTS education_enrollment_read ON public.education_enrollments;
CREATE POLICY education_enrollment_read ON public.education_enrollments FOR SELECT TO authenticated
USING (student_id = auth.uid() OR (admin_id = auth.uid() AND public.is_education_admin()));
DROP POLICY IF EXISTS education_enrollment_update ON public.education_enrollments;
CREATE POLICY education_enrollment_update ON public.education_enrollments FOR UPDATE TO authenticated
USING (admin_id = auth.uid() AND public.is_education_admin())
WITH CHECK (admin_id = auth.uid() AND public.is_education_admin());
DROP POLICY IF EXISTS education_enrollment_delete ON public.education_enrollments;
CREATE POLICY education_enrollment_delete ON public.education_enrollments FOR DELETE TO authenticated
USING (student_id = auth.uid() OR (admin_id = auth.uid() AND public.is_education_admin()));

-- Allows the learner to see the manager's name BEFORE consenting. No roster is exposed.
CREATE OR REPLACE FUNCTION public.preview_education_invite(p_code uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE manager_name text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT a.display_name INTO manager_name FROM public.education_invites i
 JOIN public.education_admins a ON a.user_id = i.admin_id
 WHERE i.code = p_code AND i.claimed_at IS NULL AND i.expires_at > now();
 IF manager_name IS NULL THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
 RETURN manager_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_education_invite(p_code uuid, p_name text, p_consent boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation public.education_invites;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_consent IS DISTINCT FROM true THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'NAME_INVALID'; END IF;
 SELECT * INTO invitation FROM public.education_invites WHERE code = p_code FOR UPDATE;
 IF NOT FOUND OR invitation.claimed_at IS NOT NULL OR invitation.expires_at <= now() THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
 IF invitation.admin_id = auth.uid() THEN RAISE EXCEPTION 'SELF_INVITE'; END IF;
 INSERT INTO public.education_enrollments(admin_id,student_id,display_name)
 VALUES (invitation.admin_id,auth.uid(),btrim(p_name));
 UPDATE public.education_invites SET claimed_at = now() WHERE id = invitation.id;
END;
$$;

-- Only a narrow educational summary; never grants admins access to whole progress rows,
-- private conversations, profiles, device tables, or other managers' students.
CREATE OR REPLACE FUNCTION public.education_roster()
RETURNS TABLE(student_id uuid, display_name text, status text, consent_at timestamptz, synced_at timestamptz, summary jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.is_education_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 RETURN QUERY SELECT e.student_id,e.display_name,e.status,e.consent_at,
 CASE WHEN e.status = 'active' THEN p.updated_at END,
 CASE WHEN e.status = 'active' AND p.user_id IS NOT NULL THEN jsonb_build_object(
 'completedLessonIds',p.progress->'completedLessonIds',
 'learnedEssential504Words',p.progress->'learnedEssential504Words',
 'totalMinutes',p.progress->'totalMinutes',
 'currentStreak',p.progress->'currentStreak') END
 FROM public.education_enrollments e LEFT JOIN public.learning_progress p ON p.user_id = e.student_id
 WHERE e.admin_id = auth.uid() ORDER BY e.consent_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.preview_education_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_education_invite(uuid,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.education_roster() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_education_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_education_invite(uuid,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.education_roster() TO authenticated;
COMMIT;

-- ================= COPY FROM supabase/migrations/202610070002_education_disabled_default.sql =================
-- Default-off switch for the educational admin backend.
-- Does not disable students' ability to withdraw previous consent.
BEGIN;
CREATE TABLE IF NOT EXISTS public.education_feature_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 management_enabled boolean NOT NULL DEFAULT false
);
ALTER TABLE public.education_feature_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.education_feature_settings FROM PUBLIC, anon, authenticated;
INSERT INTO public.education_feature_settings(id,management_enabled) VALUES (true,false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.education_management_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT COALESCE((SELECT management_enabled FROM public.education_feature_settings WHERE id),false);
$$;
REVOKE ALL ON FUNCTION public.education_management_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.education_management_enabled() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_education_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.education_management_enabled() AND EXISTS (
 SELECT 1 FROM public.education_admins WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_education_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_education_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_education_invite(p_code uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE manager_name text;
BEGIN
 IF NOT public.education_management_enabled() THEN RAISE EXCEPTION 'EDUCATION_DISABLED'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT a.display_name INTO manager_name FROM public.education_invites i
 JOIN public.education_admins a ON a.user_id = i.admin_id
 WHERE i.code = p_code AND i.claimed_at IS NULL AND i.expires_at > now();
 IF manager_name IS NULL THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
 RETURN manager_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_education_invite(p_code uuid, p_name text, p_consent boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation public.education_invites;
BEGIN
 IF NOT public.education_management_enabled() THEN RAISE EXCEPTION 'EDUCATION_DISABLED'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_consent IS DISTINCT FROM true THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'NAME_INVALID'; END IF;
 SELECT * INTO invitation FROM public.education_invites WHERE code = p_code FOR UPDATE;
 IF NOT FOUND OR invitation.claimed_at IS NOT NULL OR invitation.expires_at <= now() THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
 IF invitation.admin_id = auth.uid() THEN RAISE EXCEPTION 'SELF_INVITE'; END IF;
 INSERT INTO public.education_enrollments(admin_id,student_id,display_name)
 VALUES (invitation.admin_id,auth.uid(),btrim(p_name));
 UPDATE public.education_invites SET claimed_at = now() WHERE id = invitation.id;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_education_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_education_invite(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_education_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_education_invite(uuid,text,boolean) TO authenticated;
COMMIT;

-- ================= COPY FROM supabase/migrations/202610140001_chat_push_notifications.sql =================
-- Device registrations used by the chat notification Edge Function.
CREATE TABLE IF NOT EXISTS public.chat_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL CHECK (expo_push_token ~ '^ExponentPushToken|^ExpoPushToken'),
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  device_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_chat_push_tokens_user ON public.chat_push_tokens(user_id);
ALTER TABLE public.chat_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_push_tokens_read_self ON public.chat_push_tokens;
CREATE POLICY chat_push_tokens_read_self ON public.chat_push_tokens
FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS chat_push_tokens_insert_self ON public.chat_push_tokens;
CREATE POLICY chat_push_tokens_insert_self ON public.chat_push_tokens
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS chat_push_tokens_update_self ON public.chat_push_tokens;
CREATE POLICY chat_push_tokens_update_self ON public.chat_push_tokens
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS chat_push_tokens_delete_self ON public.chat_push_tokens;
CREATE POLICY chat_push_tokens_delete_self ON public.chat_push_tokens
FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_push_tokens TO authenticated;

-- The foreground/background realtime bridge listens for accepted contacts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'learning_contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.learning_contacts;
  END IF;
END $$;

-- ================= COPY FROM supabase/migrations/202610140002_registered_users_admin.sql =================
-- Registered learner directory for the single-owner management application.
-- Profiles contain account/operational metadata only; private messages are never exposed.
BEGIN;

CREATE TABLE IF NOT EXISTS public.app_user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 80),
  email text NOT NULL CHECK (length(btrim(email)) BETWEEN 3 AND 254),
  platform text CHECK (platform IN ('android', 'ios', 'web')),
  app_version text,
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_user_profiles_last_seen_idx
  ON public.app_user_profiles(last_seen_at DESC);

ALTER TABLE public.app_user_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_user_profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.app_user_profiles TO authenticated;

DROP POLICY IF EXISTS app_user_profiles_read_self ON public.app_user_profiles;
CREATE POLICY app_user_profiles_read_self ON public.app_user_profiles
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS app_user_profiles_insert_self ON public.app_user_profiles;
CREATE POLICY app_user_profiles_insert_self ON public.app_user_profiles
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS app_user_profiles_update_self ON public.app_user_profiles;
CREATE POLICY app_user_profiles_update_self ON public.app_user_profiles
FOR UPDATE TO authenticated USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

CREATE OR REPLACE FUNCTION public.admin_registered_users()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text,
  platform text,
  app_version text,
  registered_at timestamptz,
  last_seen_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_education_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  RETURN QUERY
  SELECT p.user_id, p.full_name, p.email, p.platform, p.app_version,
         p.registered_at, p.last_seen_at
  FROM public.app_user_profiles p
  ORDER BY p.registered_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_registered_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_registered_users() TO authenticated;

-- Exactly one operational manager may exist. The migration intentionally fails
-- if production already contains multiple managers so ownership is resolved explicitly.
ALTER TABLE public.education_admins
  ADD COLUMN IF NOT EXISTS singleton_key smallint NOT NULL DEFAULT 1 CHECK (singleton_key = 1);
CREATE UNIQUE INDEX IF NOT EXISTS education_admins_single_owner_idx
  ON public.education_admins(singleton_key);

COMMIT;

-- ================= COPY FROM supabase/migrations/202610160001_support_chat_and_user_admin.sql =================
-- Learner support chat with the single manager account.
-- Each learner gets one private one-to-one conversation with the manager.
-- Reuses the existing conversations, conversation_members, learning_contacts,
-- and messages tables, so the existing RLS rules keep the chat private.
BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_support_conversation(p_display_name text DEFAULT 'زبان‌آموز')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid := auth.uid();
  manager_id uuid;
  existing_conversation uuid;
  new_conversation_id uuid;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT user_id INTO manager_id FROM public.education_admins
  WHERE singleton_key = 1 LIMIT 1;
  IF manager_id IS NULL THEN RAISE EXCEPTION 'SUPPORT_UNAVAILABLE'; END IF;
  IF manager_id = caller_id THEN RAISE EXCEPTION 'SUPPORT_SELF'; END IF;

  SELECT conversation_id INTO existing_conversation FROM public.learning_contacts
  WHERE user_id = caller_id AND contact_id = manager_id;
  IF existing_conversation IS NOT NULL THEN RETURN existing_conversation; END IF;

  INSERT INTO public.profiles (id, display_name, last_seen)
  VALUES (caller_id, COALESCE(NULLIF(btrim(p_display_name), ''), 'زبان‌آموز'), now())
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, last_seen = now();

  INSERT INTO public.profiles (id, display_name, last_seen)
  VALUES (manager_id, 'پشتیبانی Milo', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO new_conversation_id;
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (new_conversation_id, manager_id), (new_conversation_id, caller_id);
  INSERT INTO public.learning_contacts (user_id, contact_id, conversation_id)
  VALUES
    (manager_id, caller_id, new_conversation_id),
    (caller_id, manager_id, new_conversation_id);

  RETURN new_conversation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_support_conversation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_support_conversation(text) TO authenticated;

COMMIT;

-- ================= COPY FROM supabase/migrations/202610170001_offline_chat_push_queue.sql =================
-- Durable, deduplicated chat push outbox. Messages and support requests are
-- enqueued in the same transaction as their source event; a pg_cron wake-up
-- calls the Edge Function even if every app instance is closed.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- The current support flow creates a conversation immediately. Add only the
-- missing, explicit lifecycle state so managers can close/reopen a request.
CREATE TABLE IF NOT EXISTS public.support_chat_requests (
  conversation_id uuid PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  status_version bigint NOT NULL DEFAULT 0 CHECK (status_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (learner_id <> manager_id)
);
ALTER TABLE public.support_chat_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_chat_requests FROM PUBLIC, anon;
GRANT SELECT ON public.support_chat_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_chat_requests TO service_role;
DROP POLICY IF EXISTS support_chat_requests_participants_read ON public.support_chat_requests;
CREATE POLICY support_chat_requests_participants_read ON public.support_chat_requests
  FOR SELECT TO authenticated USING (auth.uid() = learner_id OR auth.uid() = manager_id);

INSERT INTO public.support_chat_requests(conversation_id, learner_id, manager_id)
SELECT DISTINCT lc.conversation_id, lc.user_id, lc.contact_id
  FROM public.learning_contacts lc
  JOIN public.education_admins a ON a.user_id = lc.contact_id AND a.singleton_key = 1
 WHERE lc.user_id <> a.user_id
ON CONFLICT (conversation_id) DO NOTHING;

-- Mark support conversations explicitly before their symmetric contact rows are
-- inserted; normal six-digit contact invitations remain normal conversations.
CREATE OR REPLACE FUNCTION public.ensure_support_conversation(p_display_name text DEFAULT 'زبان‌آموز')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  caller_id uuid := auth.uid();
  manager_id uuid;
  existing_conversation uuid;
  new_conversation_id uuid;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT user_id INTO manager_id FROM public.education_admins WHERE singleton_key = 1 LIMIT 1;
  IF manager_id IS NULL THEN RAISE EXCEPTION 'SUPPORT_UNAVAILABLE'; END IF;
  IF manager_id = caller_id THEN RAISE EXCEPTION 'SUPPORT_SELF'; END IF;

  SELECT conversation_id INTO existing_conversation FROM public.learning_contacts
   WHERE user_id = caller_id AND contact_id = manager_id;
  IF existing_conversation IS NOT NULL THEN RETURN existing_conversation; END IF;

  INSERT INTO public.profiles (id, display_name, last_seen)
  VALUES (caller_id, COALESCE(NULLIF(btrim(p_display_name), ''), 'زبان‌آموز'), now())
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, last_seen = now();
  INSERT INTO public.profiles (id, display_name, last_seen)
  VALUES (manager_id, 'پشتیبانی Milo', now()) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO new_conversation_id;
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (new_conversation_id, manager_id), (new_conversation_id, caller_id);
  INSERT INTO public.support_chat_requests(conversation_id, learner_id, manager_id)
  VALUES (new_conversation_id, caller_id, manager_id);
  INSERT INTO public.learning_contacts (user_id, contact_id, conversation_id)
  VALUES (manager_id, caller_id, new_conversation_id), (caller_id, manager_id, new_conversation_id);
  RETURN new_conversation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_support_conversation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_support_conversation(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_support_chat_status(p_conversation_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_status NOT IN ('open', 'resolved') THEN RAISE EXCEPTION 'Invalid support status'; END IF;
  UPDATE public.support_chat_requests
     SET status = p_status, status_version = status_version + 1, updated_at = clock_timestamp()
   WHERE conversation_id = p_conversation_id AND manager_id = auth.uid()
     AND status IS DISTINCT FROM p_status;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 0 AND NOT EXISTS (
    SELECT 1 FROM public.support_chat_requests
     WHERE conversation_id = p_conversation_id AND manager_id = auth.uid() AND status = p_status
  ) THEN RAISE EXCEPTION 'SUPPORT_REQUEST_NOT_FOUND'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_support_chat_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_support_chat_status(uuid,text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.chat_push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  expo_ticket_id text,
  delivered_tokens text[] NOT NULL DEFAULT '{}'::text[],
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS chat_push_queue_pending_idx
  ON public.chat_push_queue(available_at, created_at)
  WHERE status IN ('pending', 'processing');
ALTER TABLE public.chat_push_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_push_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_push_queue TO service_role;

CREATE OR REPLACE FUNCTION public.claim_chat_push_events(p_limit integer DEFAULT 100)
RETURNS SETOF public.chat_push_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 500 THEN RAISE EXCEPTION 'Invalid batch size'; END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT q.id
    FROM public.chat_push_queue q
    WHERE (q.status = 'pending' AND q.available_at <= now())
       OR (q.status = 'processing' AND q.locked_until < now())
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.chat_push_queue q
     SET status = 'processing', attempts = q.attempts + 1,
         locked_until = now() + interval '5 minutes'
    FROM picked
   WHERE q.id = picked.id
  RETURNING q.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_chat_push_events(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_chat_push_events(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_chat_push_event(
  p_event_key text,
  p_recipient_id uuid,
  p_title text,
  p_body text,
  p_data jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.chat_push_queue(event_key, recipient_id, title, body, data)
  VALUES (p_event_key, p_recipient_id, p_title, p_body, coalesce(p_data, '{}'::jsonb))
  ON CONFLICT (event_key) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.enqueue_chat_push_event(text,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_chat_push_event(text,uuid,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_chat_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  manager_id uuid;
  recipient_id uuid;
  sender_name text;
  event_key text;
  notification_title text;
  notification_body text;
  conversation_id uuid;
  event_id text;
BEGIN
  IF TG_TABLE_NAME = 'messages' THEN
    IF NEW.message_type = 'system' THEN RETURN NEW; END IF;
    conversation_id := NEW.conversation_id;
    event_id := NEW.id::text;
    SELECT a.user_id INTO manager_id
      FROM public.education_admins a WHERE a.singleton_key = 1 LIMIT 1;
    SELECT coalesce(nullif(btrim(p.display_name), ''), 'زبان‌آموز') INTO sender_name
      FROM public.profiles p WHERE p.id = NEW.sender_id;

    FOR recipient_id IN
      SELECT cm.user_id FROM public.conversation_members cm
       WHERE cm.conversation_id = NEW.conversation_id AND cm.user_id <> NEW.sender_id
    LOOP
      IF manager_id IS NOT NULL AND recipient_id = manager_id THEN
        notification_title := 'پیام تازه از ' || coalesce(sender_name, 'زبان‌آموز');
      ELSIF manager_id IS NOT NULL AND NEW.sender_id = manager_id THEN
        notification_title := 'پیام تازه از پشتیبانی';
      ELSE
        notification_title := 'پیام تازه از ' || coalesce(sender_name, 'مخاطب');
      END IF;
      notification_body := 'برای دیدن پیام، گفتگو را باز کنید.';
      event_key := 'message:' || NEW.id::text || ':' || recipient_id::text;
      PERFORM public.enqueue_chat_push_event(
        event_key, recipient_id, notification_title, notification_body,
        jsonb_build_object(
          'eventId', event_key,
          'conversationId', conversation_id::text,
          'route', '/conversations/human/' || conversation_id::text
        )
      );
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'learning_contacts' THEN
    SELECT a.user_id INTO manager_id
      FROM public.education_admins a WHERE a.singleton_key = 1 LIMIT 1;
    conversation_id := NEW.conversation_id;

    -- The new status row distinguishes the support RPC from ordinary contact
    -- invitation claims, even when the manager happens to be a contact.
    IF EXISTS (
      SELECT 1 FROM public.support_chat_requests r WHERE r.conversation_id = conversation_id
    ) THEN
      IF manager_id IS NOT NULL AND NEW.contact_id = manager_id AND NEW.user_id <> manager_id THEN
        event_key := 'support-request:' || conversation_id::text || ':' || manager_id::text;
        PERFORM public.enqueue_chat_push_event(
          event_key, manager_id, 'درخواست چت تازه', 'یک زبان‌آموز درخواست پشتیبانی دارد.',
          jsonb_build_object(
            'eventId', event_key,
            'conversationId', conversation_id::text,
            'route', '/conversations/human/' || conversation_id::text
          )
        );
      END IF;
    ELSE
      event_key := 'contact:' || conversation_id::text || ':' || NEW.user_id::text;
      PERFORM public.enqueue_chat_push_event(
        event_key, NEW.user_id, 'گفتگوی تازه', 'یک گفتگوی تازه برای شما فعال شد.',
        jsonb_build_object(
          'eventId', event_key,
          'conversationId', conversation_id::text,
          'route', '/conversations/human/' || conversation_id::text
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'app_user_profiles' THEN
    event_key := 'registration:' || NEW.user_id::text;
    FOR recipient_id IN SELECT a.user_id FROM public.education_admins a LOOP
      PERFORM public.enqueue_chat_push_event(
        event_key || ':' || recipient_id::text, recipient_id,
        'ثبت‌نام کاربر جدید', 'یک زبان‌آموز تازه در میلو ثبت‌نام کرد.',
        jsonb_build_object('eventId', event_key || ':' || recipient_id::text, 'route', '/admin')
      );
    END LOOP;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_push_queue_message ON public.messages;
CREATE TRIGGER chat_push_queue_message AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enqueue_chat_notification();
DROP TRIGGER IF EXISTS chat_push_queue_contact ON public.learning_contacts;
CREATE TRIGGER chat_push_queue_contact AFTER INSERT ON public.learning_contacts
FOR EACH ROW EXECUTE FUNCTION public.enqueue_chat_notification();
DROP TRIGGER IF EXISTS chat_push_queue_registration ON public.app_user_profiles;
CREATE TRIGGER chat_push_queue_registration AFTER INSERT ON public.app_user_profiles
FOR EACH ROW EXECUTE FUNCTION public.enqueue_chat_notification();

CREATE OR REPLACE FUNCTION public.enqueue_support_status_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  event_key text;
  status_text text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  event_key := 'support-status:' || NEW.conversation_id::text || ':' || NEW.status_version::text || ':' || NEW.learner_id::text;
  status_text := CASE NEW.status WHEN 'resolved' THEN 'درخواست شما رسیدگی شد.' ELSE 'درخواست شما دوباره فعال شد.' END;
  PERFORM public.enqueue_chat_push_event(
    event_key, NEW.learner_id, 'وضعیت درخواست پشتیبانی تغییر کرد', status_text,
    jsonb_build_object(
      'eventId', event_key,
      'conversationId', NEW.conversation_id::text,
      'route', '/conversations/human/' || NEW.conversation_id::text
    )
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS chat_push_queue_support_status ON public.support_chat_requests;
CREATE TRIGGER chat_push_queue_support_status AFTER UPDATE OF status ON public.support_chat_requests
FOR EACH ROW EXECUTE FUNCTION public.enqueue_support_status_notification();

-- Add the one shared webhook secret to Supabase Vault before running this SQL.
-- Replace this placeholder with the exact same value as CHAT_WEBHOOK_SECRET in
-- Edge Function Secrets. Never commit an actual secret to the repository.
-- SELECT vault.create_secret('REPLACE_WITH_A_LONG_RANDOM_SECRET', 'chat_push_webhook_secret');

DO $$
DECLARE
  net_schema text;
  cron_schema text;
  existing_job bigint;
BEGIN
  SELECT n.nspname INTO net_schema
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'pg_net';
  IF net_schema IS NULL THEN RAISE EXCEPTION 'pg_net extension is required'; END IF;

  -- The database only wakes the function when work is available. The one-minute
  -- cron retry also recovers from function/network outages without app clients.
  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.wake_chat_push()
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
    DECLARE shared_secret text; request_id bigint;
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM public.chat_push_queue q
        WHERE (q.status = 'pending' AND q.available_at <= now())
           OR (q.status = 'processing' AND q.locked_until < now())
      ) THEN RETURN; END IF;
      SELECT v.decrypted_secret INTO shared_secret
        FROM vault.decrypted_secrets v
       WHERE v.name = 'chat_push_webhook_secret'
       ORDER BY v.created_at DESC LIMIT 1;
      IF shared_secret IS NULL OR shared_secret = '' THEN RETURN; END IF;
      EXECUTE format('SELECT %%I.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 5000)', %L)
        INTO request_id
        USING 'https://doagwkssxtxseuavrxnr.supabase.co/functions/v1/chat-push',
          jsonb_build_object('Content-Type','application/json','x-chat-webhook-secret',shared_secret),
          '{}'::jsonb;
    END;
    $body$;
  $fn$, net_schema);
  REVOKE ALL ON FUNCTION public.wake_chat_push() FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.wake_chat_push() TO service_role;

  SELECT n.nspname INTO cron_schema
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'pg_cron';
  IF cron_schema IS NULL THEN RAISE EXCEPTION 'pg_cron extension is required'; END IF;
  EXECUTE format('SELECT jobid FROM %I.job WHERE jobname = $1', cron_schema)
    INTO existing_job USING 'chat-push-queue-drain';
  IF existing_job IS NOT NULL THEN
    EXECUTE format('SELECT %I.unschedule($1)', cron_schema) USING existing_job;
  END IF;
  EXECUTE format('SELECT %I.schedule($1, $2, $3)', cron_schema)
    USING 'chat-push-queue-drain', '* * * * *', 'SELECT public.wake_chat_push();';
END;
$$;

-- Wake promptly on each queued event; pg_cron above retries pending rows.
CREATE OR REPLACE FUNCTION public.wake_chat_push_after_queue_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.wake_chat_push();
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.wake_chat_push_after_queue_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_push_queue_wakeup ON public.chat_push_queue;
CREATE TRIGGER chat_push_queue_wakeup
  AFTER INSERT ON public.chat_push_queue
  FOR EACH STATEMENT EXECUTE FUNCTION public.wake_chat_push_after_queue_insert();

COMMIT;
