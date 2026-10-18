#!/usr/bin/env node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
let checks = 0;
const verify = (name, condition) => { assert.ok(condition, name); checks += 1; };
const admin = '00000000-0000-4000-8000-000000000001';
const student = '00000000-0000-4000-8000-000000000002';
const otherAdmin = '00000000-0000-4000-8000-000000000003';
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
  $$;
  GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
  INSERT INTO auth.users VALUES ('${admin}'),('${student}'),('${otherAdmin}');
  CREATE TABLE public.education_admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id));
  INSERT INTO public.education_admins VALUES ('${admin}'),('${otherAdmin}');
  CREATE FUNCTION public.is_education_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT EXISTS(SELECT 1 FROM public.education_admins WHERE user_id=auth.uid())
  $$;
  CREATE TABLE public.app_user_profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id),full_name text,email text,platform text,app_version text,registered_at timestamptz,last_seen_at timestamptz);
  INSERT INTO public.app_user_profiles VALUES ('${student}','Student','student@example.com','android','1.0.0',now(),now());
  CREATE TABLE public.education_feature_settings(id boolean PRIMARY KEY DEFAULT true,management_enabled boolean NOT NULL DEFAULT true);
  INSERT INTO public.education_feature_settings(id,management_enabled) VALUES (true,true);
`);
const baseMigration = readFileSync(new URL('../supabase/migrations/202610170002_access_control_and_app_updates.sql', import.meta.url), 'utf8');
const pauseMigration = readFileSync(new URL('../supabase/migrations/202610180001_pause_app_release_management.sql', import.meta.url), 'utf8');
await db.exec(baseMigration);
await db.exec(baseMigration);
verify('historical migration remains idempotent', true);

async function as(user, role = 'authenticated') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user || '']);
  await db.exec(`SET ROLE ${role}`);
}
async function rejected(name, query, args = []) {
  let failed = false;
  try { await db.query(query, args); } catch { failed = true; }
  verify(name, failed);
}

// Simulate a previously enabled force-update policy, then apply the new
// deactivation migration so older installed clients can clear their cache.
await as(admin);
await db.query("SELECT public.admin_save_app_release_policy('com.devicecontrol.companion','1.2.0','1.1.0','https://github.com/milanorezaee2/App2/releases/download/test/MiloMultilang.apk','Old policy',true,true)");
await db.exec('RESET ROLE');
await db.exec(pauseMigration);
const disabledPolicy = (await db.query("SELECT enabled, force_update FROM public.app_release_policies WHERE package_name='com.devicecontrol.companion'")).rows[0];
verify('migration disables previously saved update and force flags', disabledPolicy.enabled === false && disabledPolicy.force_update === false);
await as(admin);
await rejected('admin release-write RPC is removed', "SELECT public.admin_save_app_release_policy('com.devicecontrol.companion','1.2.0','1.1.0','https://github.com/milanorezaee2/App2/releases/download/test/MiloMultilang.apk','',true,true)");
await rejected('admin release-list RPC is removed', 'SELECT * FROM public.admin_app_release_policies()');
await as(null, 'anon');
verify('legacy clients see no active policy and can clear cached forced-update state', (await db.query("SELECT public.public_app_release_policy('com.devicecontrol.companion') AS policy")).rows[0].policy === null);

await as(admin);
await db.query('SELECT public.admin_set_app_user_access($1, true, $2)', [student, 'Access test']);
await as(student);
const blocked = (await db.query('SELECT public.current_app_access() AS state')).rows[0].state;
verify('user can read own blocked state and reason', blocked.blocked === true && blocked.reason === 'Access test');
await rejected('learner cannot change own access state', 'SELECT public.admin_set_app_user_access($1, true, NULL)', [student]);
await as(admin);
await rejected('admin cannot change own access state', 'SELECT public.admin_set_app_user_access($1, true, NULL)', [admin]);
await rejected('admin cannot block another admin', 'SELECT public.admin_set_app_user_access($1, true, NULL)', [otherAdmin]);
await db.query('SELECT public.admin_set_app_user_access($1, false, NULL)', [student]);
await as(student);
const unblocked = (await db.query('SELECT public.current_app_access() AS state')).rows[0].state;
verify('unblocking clears the reason', unblocked.blocked === false && unblocked.reason === null);
await as(null, 'anon');
const anonymous = (await db.query('SELECT public.current_app_access() AS state')).rows[0].state;
verify('anonymous users are not accidentally blocked', anonymous.blocked === false);
await db.exec('RESET ROLE');
await db.close();
console.log(`App-access and update-deactivation SQL: ${checks} checks passed.`);
