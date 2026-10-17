// Public Supabase connection settings (URL + anon key only, never secrets).
// Resolution order: EXPO_PUBLIC_* env vars at bundle time, then the committed
// config/supabase.public.json. The fallback matters because some build paths
// (for example EAS or a plain `expo export`) do not run the npm scripts that
// load that file, which previously baked a placeholder URL into the app and
// made every login fail with "ارتباط با سرور برقرار نشد".
import publicConfig from '../config/supabase.public.json';

const saved = publicConfig as { EXPO_PUBLIC_SUPABASE_URL?: string; EXPO_PUBLIC_SUPABASE_ANON_KEY?: string };

export const SUPABASE_PUBLIC_URL = (
  process.env.EXPO_PUBLIC_SUPABASE_URL || saved.EXPO_PUBLIC_SUPABASE_URL || ''
).trim();

export const SUPABASE_PUBLIC_ANON_KEY = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || saved.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
).trim();

const TEMPLATE_URL_MARKERS = ['placeholder', 'your-project', 'example.com'];
const TEMPLATE_KEY_MARKERS = ['your-anon-key', 'placeholder-anon-key'];

/** True only when both public app connection values are real project settings. */
export function isSupabaseConfigured(): boolean {
  if (!SUPABASE_PUBLIC_URL.startsWith('https://')) return false;
  if (TEMPLATE_URL_MARKERS.some(marker => SUPABASE_PUBLIC_URL.includes(marker))) return false;
  if (!SUPABASE_PUBLIC_ANON_KEY) return false;
  if (TEMPLATE_KEY_MARKERS.some(marker => SUPABASE_PUBLIC_ANON_KEY.includes(marker))) return false;
  return true;
}
