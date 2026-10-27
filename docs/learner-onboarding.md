# Authenticated learner onboarding and progress

Applies only to App 4 (`login_en_de_tr`). Admin and no-login editions retain their existing entry screens.

## Flow

`RegistrationGate` still verifies the session and registration profile (email OTP / Google PKCE). Inside the existing language-access provider, `LearnerJourneyGate` loads account-specific **on-device preferences**. A first-time account chooses an enabled language, self-reported familiarity, a learning goal, then confirms. The navigator mounts after a successful save. Returning accounts land on `/journey` without repeating setup.

The dashboard offers the existing language corridor, the actual library filtered by the suggested numeric level, and a way to revise choices. Familiarity maps to published course levels (English 0–4; German/Turkish 0–3). This is **not a placement examination or CEFR certificate**. Goals record intent; they do not silently reorder lessons. No lower lessons are marked complete and no learning records are reset.

Preferences use `learner_journey_v1:<encoded user ID>`, with separate saved paths for each language. Account changes invalidate in-memory state and outstanding loads. Storage errors keep onboarding open; malformed saved preferences require explicit retry/reselection. Only preferences are replaced by reselection.

Admin-disabled languages cannot be chosen or entered. Dashboard reports remain hidden while access is loading and are filtered by the current policy. The existing active-course access guard waits for a mounted navigator before redirecting. Root landing is driven by actual navigator mount/unmount notifications, not a timed login callback: onboarding choices are not discarded by an early redirect, and a second account lands on its dashboard after setup instead of restoring the old route.

## Report provenance and boundaries

`learnerProgressSummary.ts` is a read-only adapter, using existing curriculum arrays and existing storage keys:

- English: `sentence_course_progress_v1`, `english_study_state_v1`.
- German: `sentence_course_progress_de_v2`, per-lesson `german_sentence_session_v1:*`.
- Turkish: `sentence_course_progress_tr_v1`, `turkish_lesson_sessions_v1`.

It deduplicates known completed lessons/cards, excludes retired curriculum IDs, counts sentences belonging to completed lessons (not mastered sentences), counts saved unfinished sessions, checks due dates, reports per-level completion, dates and streaks, and expires stale active streaks. English measured time comes from `StudyState.days` in milliseconds. Historical progress minutes are explicitly identified as possibly estimated and never added to measured time. German/Turkish measured time is unavailable, not inferred as zero. Missing records represent no saved evidence; malformed/unavailable records produce a visible error or an explicitly unknown session/time count, not apparently empty progress. Reading reports never writes, normalizes, synchronizes, or clears course records.

Course progress remains in the app's existing **device-wide** stores; this change does not migrate ownership or claim that all older on-device history belongs to the current account. The UI discloses this distinction. Preference keys are account-scoped, not cloud-synced. The existing explicit personal sync supports English/German; Turkish remains local. The dashboard's sync action uses that existing service and reports failures without suppressing the local report. Independent workshops, pronunciation and supplementary activities retain their own detailed views; their counts are not mixed into sentence-course percentages.

## Verification

- `npm run typecheck`
- `npm run validate:learner-journey`: 23 storage/schema/account-isolation, actual-curriculum, no-write, measured-time, error and integration-wiring checks. Included in Android CI.
- `node scripts/verify-learner-journey-browser.mjs`: optional isolated real-component browser integration; 20 scenarios including required choices, persistence, suggested Turkish level, account changes, admin revocation/all-disabled state, storage failures, existing history, corrupt progress, sync failure, mobile overflow and runtime errors. Install `playwright` and `@sparticuz/chromium` in an external dependency directory and set `JOURNEY_BROWSER_DEPS` (default: ignored `node_modules/.cache/journey-browser/deps`). Auth and language-access boundaries are test doubles; this does not test delivery of a real OTP or Google provider configuration.
- `node scripts/verify-learner-journey-production.cjs` against a served login-edition production Expo web export (`BROWSER_BASE_URL`, default port 8081), with locally intercepted backend fixtures: first setup before Stack mount, `/journey` landing, actual German A2 library navigation, course home icon, selected corridor, returning-session boot, actual OTP-UI fixture login into a second account after sign-out, second-account setup/landing, and absence of navigation-before-mount errors. The dashboard links to existing account management/sign-out.
- Existing email/Google, embedded-font, admin/RLS, popup/language-access, narration, Turkish and Russian regressions remain applicable. Four signed APKs are installed/launched by the existing Android-emulator release gate. Real provider login and every physical device are not covered by emulator/browser fixtures.
