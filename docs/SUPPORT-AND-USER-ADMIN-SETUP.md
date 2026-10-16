# Support chat and manager user tools: setup

These changes need two backend steps. CI does not run them.

1. Apply the migration `supabase/migrations/202610160001_support_chat_and_user_admin.sql`
   in the Supabase SQL editor, or with `supabase db push`.
   It adds `ensure_support_conversation()`, which gives each learner one private
   conversation with the single manager account in `education_admins`.

2. Deploy the Edge Function that permanently deletes learner accounts:

   ```
   supabase functions deploy admin-delete-user
   ```

   The function checks the caller's JWT with `is_education_admin()` before it
   uses the service-role key. `SUPABASE_SERVICE_ROLE_KEY` is provided by Supabase
   to deployed functions and must never be placed in the APK.

## What the deletion removes

- The auth account (`auth.users`), with cascading deletes for profile rows.
- Learning-contact links and conversation memberships for that learner.
- The `profiles` row.

Stored voice-message files in the `chat-voice` bucket are not deleted by this
function. Remove them separately if you need that.

## Manager user list

- Each user row has a **حذف** button. Confirmation is required, and the manager
  account and the manager's own account are protected.
- **دانلود فهرست** exports account metadata as CSV: name, email, platform,
  app version, and activity dates. Private messages and learning progress are not included.
