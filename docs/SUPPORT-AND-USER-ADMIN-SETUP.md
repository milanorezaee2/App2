# Manager user tools: setup

The support chat was removed. The manager user tools remain.

## Permanent user deletion (Edge Function)

Deploy once: `supabase functions deploy admin-delete-user`

The function checks the caller with `is_education_admin()` before it uses the
service-role key. It deletes the auth account and cascades to profile rows. It
also removes the learner's learning-contact links, conversation memberships, and
`profiles` row. Stored voice-message files in the `chat-voice` bucket are not deleted.

## Manager user list

- Each user row has a **حذف** button. Confirmation is required, and the manager cannot delete their own account or other manager accounts.
- **دانلود فهرست** exports account metadata as CSV: name, email, platform, app version, and activity dates. Private messages and learning progress are not included.

## Optional cleanup in Supabase

If the earlier support migration was applied, you can remove its function:

```sql
drop function if exists public.ensure_support_conversation(text);
```
