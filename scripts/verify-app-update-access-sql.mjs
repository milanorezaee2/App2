#!/usr/bin/env node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
let checks = 0;
const verify = (name, condition) => { assert.ok(condition, name); checks += 1; };
const admin = '00000000-0000-4000-8000-000000000001';
const student = '00000000-0000-4000-8000-000000000002';
const stranger = '00000000-0000-4000-8000-000000000003';
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
  $$;
  GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
  INSERT INTO auth.users VALUES ('${admin}'),('${student}'),('${stranger}');
  CREATE TABLE public.education_admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id));
  INSERT INTO public.education_admins VALUES ('${admin}');
  CREATE FUNCTION public.is_education_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT EXISTS(SELECT 1 FROM public.education_admins WHERE user_id=auth.uid())
  $$;
  CREATE TABLE public.app_user_profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id),full_name text,email text,platform text,app_version text,registered_at timestamptz,last_seen_at timestamptz);
  INSERT INTO public.app_user_profiles VALUES ('${student}','Student','student@example.com','android','1.0.0',now(),now());
  CREATE TABLE public.education_feature_settings(id boolean PRIMARY KEY DEFAULT true,management_enabled boolean NOT NULL DEFAULT true);
  INSERT INTO public.education_feature_settings(id,management_enabled) VALUES (true,true);
`);
const migration = readFileSync(new URL('../supabase/migrations/202610170002_access_control_and_app_updates.sql', import.meta.url), 'utf8');
await db.exec(migration);
await db.exec(migration);
verify('migration is idempotent', true);

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

await as(admin);
await db.query('SELECT public.admin_set_app_user_access($1, true, $2)', [student, 'Policy test']);
await as(student);
const state = (await db.query('SELECT public.current_app_access() AS state')).rows[0].state;
verify('user reads own blocked status and reason', state.blocked === true && state.reason === 'Policy test');
await as(admin);
await db.query('SELECT public.admin_set_app_user_access($1, false, NULL)', [student]);
await as(student);
verify('unblocked status immediately clears reason', (await db.query('SELECT public.current_app_access() AS state')).rows[0].state.blocked === false);
await rejected('student cannot change own access flag', 'SELECT public.admin_set_app_user_access($1, true, NULL)', [student]);
await rejected('unrelated account cannot list release policies', 'SELECT * FROM public.admin_app_release_policies()');
await rejected('unrelated account cannot publish a release', "SELECT public.admin_save_app_release_policy('com.devicecontrol.companion','1.1.0','1.1.0','https://github.com/milanorezaee2/App2/releases/download/test/MiloMultilang.apk','','true','true')");
await as(admin);
await db.query("SELECT public.admin_save_app_release_policy('com.devicecontrol.companion','1.1.0','1.1.0','https://github.com/milanorezaee2/App2/releases/download/test/MiloMultilang.apk','Test release',true,true)");
await as(null, 'anon');
const policy = (await db.query("SELECT public.public_app_release_policy('com.devicecontrol.companion') AS policy")).rows[0].policy;
verify('public app can read only the enabled release fields', policy.enabled === true && policy.force_update === true && policy.apk_url.endsWith('/MiloMultilang.apk'));
verify('disabled or unknown app policy remains unavailable', (await db.query("SELECT public.public_app_release_policy('unknown.package') AS policy")).rows[0].policy === null);
await rejected('anon cannot write release policy directly', "INSERT INTO public.app_release_policies(package_name,latest_version,minimum_version,apk_url) VALUES ('com.devicecontrol.companion','1.1.0','1.1.0','https://github.com/milanorezaee2/App2/releases/download/test/MiloMultilang.apk')");
await as(admin);
await rejected('force update cannot publish a link for another package', "SELECT public.admin_save_app_release_policy('com.devicecontrol.companion','1.1.0','1.1.0','https://github.com/milanorezaee2/App2/releases/download/test/MiloAdmin.apk','',true,true)");
await rejected('minimum version cannot exceed latest version', "SELECT public.admin_save_app_release_policy('com.devicecontrol.companion','1.1.0','1.2.0','https://github.com/milanorezaee2/App2/releases/download/test/MiloMultilang.apk','',true,true)");
await db.exec('RESET ROLE');
await db.close();
console.log(`Access and release-policy SQL: ${checks} checks passed.`);
