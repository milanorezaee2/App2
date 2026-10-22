/**
 * One shared level vocabulary for all three courses.
 *
 * The Russian section is the reference design (the learner asked for English and
 * German to look exactly like it). Russian shows:
 *
 *     LEVEL 0 · FOUNDATION        ← Latin badge, uppercase course name
 *     اکنون · سطح ۰               ← Persian statement of the same level
 *     rail nodes ۰..۴             ← zero-based numbers, Russian labels
 *
 * English and German had drifted: Latin rail labels (`B1–B2`, `A2–B1`), a
 * one-based node number (`numberOffset={1}`) and a hero badge reading
 * `LEVEL 0 · PRE-A1`. None of that is course content — it is only how the level
 * is labelled — so this module derives the presentation from the same data the
 * Russian screen uses.
 */

/**
 * Latin badge on the hero card, e.g. `LEVEL 0 · FOUNDATION`.
 *
 * The badge is set in a Latin display face (`Inter-ExtraBold`), exactly like
 * Russian. A course whose level names are Persian can pass a Latin fallback
 * (its CEFR band) so the badge keeps the identical shape instead of rendering
 * tofu glyphs.
 */
export function levelBadgeLabel(levelId: number, title: string, latinFallback?: string): string {
  const candidate = (title || '').trim();
  const name = /[A-Za-z]/.test(candidate) || !latinFallback ? candidate : latinFallback.trim();
  return `LEVEL ${levelId} · ${(name || candidate).toUpperCase()}`;
}

/** Persian line under the rail, e.g. `اکنون · سطح ۰`. */
export function levelStatementFa(levelId: number): string {
  return `اکنون · سطح ${levelId.toLocaleString('fa-IR')}`;
}

/**
 * Label under a rail node. Russian prints the level's own band there (`A2`,
 * `B1`, `B2`, or its Persian «سطح …» wording), so English and German use the
 * same slot with their own CEFR band instead of inventing a second taxonomy.
 */
export function levelRailLabel(level: { title?: string; cefr?: string }): string {
  return (level.cefr || level.title || '').trim();
}

/** Rail nodes are zero-based everywhere now (Russian starts at ۰). */
export const SHARED_LEVEL_NUMBER_OFFSET = 0;
