-- Offline push delivery: database triggers call the Expo push service directly
-- (pg_net) so alerts reach phones even when the receiving app is closed or the
-- manager is offline. Covers:
--   * new chat messages        -> every other conversation member
--   * accepted contact invites -> the user who received the conversation
--   * new learner registrations-> the single education manager (admin phone)
-- The optional chat-push Edge Function webhook remains available but is no
-- longer required; these triggers are applied by `supabase db push`.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_net could not be enabled: %', SQLERRM;
END $$;

DO $$
DECLARE
  net_schema text;
BEGIN
  SELECT n.nspname INTO net_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'pg_net';

  IF net_schema IS NULL THEN
    RAISE WARNING 'pg_net is unavailable on this server; offline push triggers were skipped.';
    RETURN;
  END IF;

  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.notify_chat_push()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $body$
    DECLARE
      recipients uuid[];
      push_title text;
      push_body text;
      push_conv text;
      push_data jsonb;
      push_messages jsonb;
    BEGIN
      IF TG_TABLE_NAME = 'messages' THEN
        push_conv := NEW.conversation_id::text;
        SELECT coalesce(array_agg(user_id), '{}') INTO recipients
          FROM public.conversation_members
         WHERE conversation_id = NEW.conversation_id
           AND user_id <> NEW.sender_id;
        IF NEW.message_type = 'voice' THEN
          push_title := 'پیام صوتی جدید';
          push_body := 'یک پیام صوتی جدید دریافت کردید.';
        ELSE
          push_title := 'پیام جدید';
          push_body := NULLIF(left(btrim(coalesce(NEW.body, '')), 120), '');
          IF push_body IS NULL THEN
            push_body := 'یک پیام جدید دریافت کردید.';
          END IF;
        END IF;
        push_data := jsonb_build_object(
          'conversationId', push_conv,
          'route', '/conversations/human/' || push_conv
        );
      ELSIF TG_TABLE_NAME = 'learning_contacts' THEN
        recipients := ARRAY[NEW.user_id];
        push_conv := NEW.conversation_id::text;
        push_title := 'درخواست مخاطب تأیید شد';
        push_body := 'یک گفتگوی خصوصی جدید برای شما فعال شد.';
        push_data := jsonb_build_object(
          'conversationId', push_conv,
          'route', '/conversations/human/' || push_conv
        );
      ELSIF TG_TABLE_NAME = 'app_user_profiles' THEN
        SELECT coalesce(array_agg(user_id), '{}') INTO recipients
          FROM public.education_admins;
        push_title := 'ثبت‌نام کاربر جدید در اپ زبان';
        push_body := btrim(NEW.full_name) || ' با ایمیل ' || btrim(NEW.email) || ' در اپ ثبت‌نام کرد.';
        push_data := jsonb_build_object('route', '/admin');
      ELSE
        RETURN NULL;
      END IF;

      IF recipients IS NULL OR cardinality(recipients) = 0 THEN
        RETURN NULL;
      END IF;

      SELECT jsonb_agg(jsonb_build_object(
        'to', t.expo_push_token,
        'sound', 'default',
        'title', push_title,
        'body', push_body,
        'priority', 'high',
        'channelId', 'milo-chat',
        'data', push_data
      )) INTO push_messages
        FROM public.chat_push_tokens t
       WHERE t.user_id = ANY (recipients);

      IF push_messages IS NULL THEN
        RETURN NULL;
      END IF;

      PERFORM %1$I.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := push_messages,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Accept', 'application/json'
        )
      );
      RETURN NULL;
    END;
    $body$;
  $fn$, net_schema);

  DROP TRIGGER IF EXISTS chat_push_on_message ON public.messages;
  CREATE TRIGGER chat_push_on_message
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_chat_push();

  DROP TRIGGER IF EXISTS chat_push_on_contact ON public.learning_contacts;
  CREATE TRIGGER chat_push_on_contact
    AFTER INSERT ON public.learning_contacts
    FOR EACH ROW EXECUTE FUNCTION public.notify_chat_push();

  DROP TRIGGER IF EXISTS chat_push_on_registration ON public.app_user_profiles;
  CREATE TRIGGER chat_push_on_registration
    AFTER INSERT ON public.app_user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.notify_chat_push();
END $$;
