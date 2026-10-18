#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
let checks = 0;
const verify = (condition, message) => { assert.ok(condition, message); checks += 1; };

const layout = read('app/_layout.tsx');
const admin = read('app/admin/index.tsx');
const gate = read('components/AppAccessGate.tsx');
const access = read('lib/appAccess.ts');
const accessSetup = read('supabase/APP-ACCESS-SETUP-COPY-PASTE.sql');

verify(layout.includes('<AppAccessGate>'), 'the per-account access gate remains active');
verify(!layout.includes('AppUpdateGate'), 'the app-wide release/update gate has been removed');
verify(!admin.includes('AdminReleaseManagement') && !admin.includes("'updates' as Tab"), 'the update-management tab is removed from the admin app');
verify(admin.includes('confirmUserAccess') && admin.includes('setRegisteredUserAccess'), 'admin block/allow controls remain available');
verify(gate.includes('fetchAppAccess') && access.includes("'current_app_access'"), 'the access gate still checks account status');
verify(accessSetup.includes('admin_set_app_user_access') && accessSetup.includes('current_app_access'), 'the access-only SQL setup retains manager-controlled account blocking');
verify(!accessSetup.includes('app_release_policies') && !accessSetup.includes('admin_save_app_release_policy'), 'the copy/paste access setup no longer creates app-update policies');
for (const path of ['components/AppUpdateGate.tsx', 'components/AdminReleaseManagement.tsx', 'lib/appUpdate.ts']) {
  verify(!existsSync(new URL(`../${path}`, import.meta.url)), `${path} has been removed`);
}
for (const path of ['scripts/verify-app-update-access.mjs', 'scripts/verify-app-update-access-sql.mjs']) {
  verify(!existsSync(new URL(`../${path}`, import.meta.url)), `${path} has been removed`);
}
console.log(`${checks} app-access and update-removal checks passed.`);
