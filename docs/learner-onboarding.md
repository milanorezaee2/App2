# Authenticated learner onboarding and progress

Applies only to App 4 (`login_en_de_tr`). Admin and no-login editions retain their existing entry screens.

## Flow

`RegistrationGate` still verifies the session and registration profile (email OTP / Google PKCE). Inside the existing language-access provider, `LearnerJourneyGate` loads account-specific **on-device preferences**. A first-time account chooses an enabled language only: no familiarity, placement, or goal questions. The existing v1 preference schema remains readable so upgrades do not erase account preferences. All old/new familiarity values now map to level zero. Returning accounts land on the lightweight `/journey` language entry without loading curriculum reports.

Every language entry button opens its **existing introductory library (`level=0`)**. This is a start-route policy, not a progress reset: existing completion, session and review values are preserved. No teaching text, counts, lesson IDs or lesson order are changed. `docs/repair-content-lock.json` locks the 70 educational source files recorded before this repair. The former dashboard is now a dynamically imported component opened only by the explicit report button; its language reports load incrementally rather than all together at boot. Explicit account sync remains available, but English/German homes no longer initiate full sync on every focus, and English course reads are local/read-only.

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
- `node scripts/verify-learner-journey-browser.mjs`: optional isolated real-component browser integration; 18 scenarios including language-only setup, all three introductory routes, rapid-tap protection, lazy reports, account changes, admin revocation/all-disabled state, storage failures, existing history, corrupt progress, mobile overflow and runtime errors. Install `playwright` and `@sparticuz/chromium` in an external dependency directory and set `JOURNEY_BROWSER_DEPS` (default: ignored `node_modules/.cache/journey-browser/deps`). Auth and language-access boundaries are test doubles; this does not test delivery of a real OTP or Google provider configuration.
- `node scripts/verify-learner-journey-production.cjs` against a served login-edition production Expo web export (`BROWSER_BASE_URL`, default port 8081), with locally intercepted backend fixtures: first setup before Stack mount, `/journey` landing, actual German introductory library and first-lesson navigation, course home icon, selected corridor, returning-session boot, actual OTP-UI fixture login into a second account after sign-out, second-account setup/landing, and absence of navigation-before-mount errors. Entry links to existing account management/sign-out. Returning to a tab no longer resets an open course.
- Existing email/Google, embedded-font, admin/RLS, popup/language-access, narration, Turkish and Russian regressions remain applicable. Four signed APKs are installed/launched by the existing Android-emulator release gate. Real provider login and every physical device are not covered by emulator/browser fixtures.

## Audio/stability repair

The screenshot error is an audio-source/playback failure, not evidence that curriculum text or voice assets were deleted. Default voice casting is unchanged. Playback now tries the next configured source after a CDN failure, prefers already-cached native files before network requests, does not gate cached audio on a health endpoint, expires negative and positive health caches, and deduplicates health checks. Failed health is retried after 15 seconds instead of sticking for the session.

The versioned native audio cache uses cancellable 8-second downloads into temporary files, rejects HTTP error/text responses, atomically moves successful files, and includes source URL identity in cache names. Old v1 files remain untouched but are not trusted because v1 could retain failed HTTP bodies as MP3s. Native playback has a load deadline, cancellation-safe finish, and listener/player cleanup; pausing during loading prevents late autoplay. Web playback startup/resume errors are handled. Narrator animations use the native driver, and off-focus lesson screens no longer initiate narration or duplicate current-sentence prefetch downloads. API fetch waits are bounded at eight seconds while honoring caller cancellation. Verified in-process accounts do not re-fetch their registration profile on every foreground/token event; logout still closes the gate.

Original cloud voices still require reachable configured audio infrastructure. The client cannot manufacture missing recordings or enable an unavailable external provider. An explicitly labelled **learner-selected device voice** can be used per language for the current session; there is no silent substitution of the original narrator. It requires an installed speech voice for that language. A button returns to the original narrator. No transcript is changed, no progress is deleted, and no new voice secrets are stored in the app.

`npm run validate:stability-repair` covers 27 native-boundary, timeout, cache, fallback, cancellation, read-only, flow and content-lock assertions. Fixtures verify client behavior, not availability of the real remote provider or crash-freedom on every handset.
