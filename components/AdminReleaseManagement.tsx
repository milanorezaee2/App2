import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Download, Save, ShieldAlert } from 'lucide-react-native';
import { adminClient, educationError } from '@/lib/educationAdmin';
import { RELEASE_TARGETS, type ReleaseTarget } from '@/lib/appUpdate';
import { Typography } from '@/lib/theme';

type Row = {
  package_name: string;
  latest_version: string | null;
  minimum_version: string | null;
  apk_url: string | null;
  release_notes: string | null;
  force_update: boolean | null;
  enabled: boolean | null;
  updated_at?: string | null;
};
type Draft = {
  latestVersion: string;
  minimumVersion: string;
  apkUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
  enabled: boolean;
};

const blankDraft = (): Draft => ({
  latestVersion: '1.1.0', minimumVersion: '1.1.0', apkUrl: '', releaseNotes: '', forceUpdate: false, enabled: false,
});

export function AdminReleaseManagement({ demo }: { demo: boolean }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(RELEASE_TARGETS.map(target => [target.packageName, blankDraft()])));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await adminClient().rpc('admin_app_release_policies');
      if (queryError) throw queryError;
      const rows = (data || []) as Row[];
      setDrafts(current => Object.fromEntries(RELEASE_TARGETS.map(target => {
        const row = rows.find(item => item.package_name === target.packageName);
        return [target.packageName, row ? {
          latestVersion: row.latest_version || '1.1.0',
          minimumVersion: row.minimum_version || '1.1.0',
          apkUrl: row.apk_url || '',
          releaseNotes: row.release_notes || '',
          forceUpdate: row.force_update || false,
          enabled: row.enabled || false,
        } : current[target.packageName] || blankDraft()];
      })));
    } catch (cause) {
      setError(educationError(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (!demo) void load(); else setLoading(false); }, [demo]);

  const update = (target: ReleaseTarget, patch: Partial<Draft>) => {
    setDrafts(current => ({ ...current, [target.packageName]: { ...current[target.packageName], ...patch } }));
  };

  const save = async (target: ReleaseTarget) => {
    if (demo || saving) return;
    const draft = drafts[target.packageName];
    setSaving(target.packageName);
    setError('');
    setNotice('');
    try {
      const { error: saveError } = await adminClient().rpc('admin_save_app_release_policy', {
        p_package_name: target.packageName,
        p_latest_version: draft.latestVersion.trim(),
        p_minimum_version: draft.minimumVersion.trim(),
        p_apk_url: draft.apkUrl.trim(),
        p_release_notes: draft.releaseNotes.trim(),
        p_force_update: draft.forceUpdate,
        p_enabled: draft.enabled,
      });
      if (saveError) throw saveError;
      setNotice(`تنظیمات ${target.label} ذخیره شد.`);
      await load();
    } catch (cause) {
      setError(educationError(cause));
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.info}>
        <ShieldAlert size={20} color="#9A5A09" />
        <Text style={styles.infoText}>ابتدا APK امضاشده و منتشرشده را بسازید. بعد لینک مستقیم همان فایل و نسخهٔ داخل APK را ثبت کنید. فعال‌کردن «اجباری» صفحه‌های اپ را تا نصب نسخهٔ حداقل قفل می‌کند.</Text>
      </View>
      <Text style={styles.androidNote}>Android نصب بی‌صدا را اجازه نمی‌دهد؛ کاربر باید نصب را در پنجرهٔ سیستمی تأیید کند. APK جدید نیز باید با کلید امضای پایدار همین برنامه ساخته شود.</Text>
      {demo && <Text style={styles.demo}>در پیش‌نمایش، تنظیمات واقعی ذخیره نمی‌شوند.</Text>}
      {loading && <ActivityIndicator color="#1769D2" />}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
      <View style={styles.list}>
        {RELEASE_TARGETS.map(target => {
          const draft = drafts[target.packageName] || blankDraft();
          return (
            <View key={target.packageName} style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardIcon}><Download size={18} color="#1769D2" /></View>
                <View style={styles.headingCopy}>
                  <Text style={styles.cardTitle}>{target.label}</Text>
                  <Text selectable style={styles.package}>{target.packageName}</Text>
                  <Text style={styles.package}>فایل لازم: {target.apkName}</Text>
                </View>
              </View>
              <Text style={styles.label}>نسخهٔ منتشرشده</Text>
              <TextInput accessibilityLabel={`نسخهٔ منتشرشده برای ${target.label}`} value={draft.latestVersion} onChangeText={value => update(target, { latestVersion: value })} style={styles.input} placeholder="1.1.0" autoCapitalize="none" />
              <Text style={styles.label}>کمترین نسخهٔ مجاز برای ادامهٔ استفاده</Text>
              <TextInput accessibilityLabel={`کمترین نسخهٔ مجاز برای ${target.label}`} value={draft.minimumVersion} onChangeText={value => update(target, { minimumVersion: value })} style={styles.input} placeholder="1.1.0" autoCapitalize="none" />
              <Text style={styles.hint}>برای اعلان اختیاری، حداقل را روی نسخهٔ فعلی بگذارید؛ برای قفل‌کردن نسخه‌های قدیمی، آن را روی نسخهٔ تازه تنظیم کنید.</Text>
              <Text style={styles.label}>لینک مستقیم APK منتشرشده</Text>
              <TextInput accessibilityLabel={`لینک APK برای ${target.label}`} value={draft.apkUrl} onChangeText={value => update(target, { apkUrl: value })} style={[styles.input, styles.url]} placeholder={`https://github.com/milanorezaee2/App2/releases/download/.../${target.apkName}`} autoCapitalize="none" keyboardType="url" />
              <Text style={styles.label}>یادداشت نسخه (اختیاری)</Text>
              <TextInput accessibilityLabel={`یادداشت نسخه برای ${target.label}`} value={draft.releaseNotes} onChangeText={value => update(target, { releaseNotes: value.slice(0, 500) })} style={[styles.input, styles.notes]} multiline maxLength={500} placeholder="تغییرات این نسخه…" />
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchTitle}>اعلان نسخهٔ تازه فعال باشد</Text>
                  <Text style={styles.hint}>کاربر می‌تواند فعلاً آن را ببندد.</Text>
                </View>
                <Switch accessibilityLabel={`فعال‌سازی اعلان نسخه برای ${target.label}`} value={draft.enabled} onValueChange={value => update(target, { enabled: value })} disabled={demo || !!saving} trackColor={{ false: '#C8D2DF', true: '#97C2F2' }} thumbColor={draft.enabled ? '#1769D2' : '#FFFFFF'} />
              </View>
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchTitle}>به‌روزرسانی اجباری</Text>
                  <Text style={styles.hint}>نسخه‌های پایین‌تر از حداقل، تا نصب APK قفل می‌شوند.</Text>
                </View>
                <Switch accessibilityLabel={`اجباری‌کردن به‌روزرسانی برای ${target.label}`} value={draft.forceUpdate} onValueChange={value => update(target, { forceUpdate: value, enabled: value ? true : draft.enabled })} disabled={demo || !!saving} trackColor={{ false: '#C8D2DF', true: '#F0A3A0' }} thumbColor={draft.forceUpdate ? '#B42318' : '#FFFFFF'} />
              </View>
              <Pressable accessibilityRole="button" disabled={demo || !!saving || loading} onPress={() => void save(target)} style={[styles.saveButton, (demo || !!saving || loading) && styles.disabled]}>
                {saving === target.packageName ? <ActivityIndicator color="#FFFFFF" /> : <Save size={17} color="#FFFFFF" />}
                <Text style={styles.saveText}>{saving === target.packageName ? 'در حال ذخیره…' : 'ذخیرهٔ تنظیمات این اپ'}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  info: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 13, backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#F4D9A7' },
  infoText: { flex: 1, fontFamily: Typography.fontFamily, fontSize: 10, lineHeight: 18, color: '#78500F', textAlign: 'right' },
  androidNote: { fontFamily: Typography.fontFamily, fontSize: 10, lineHeight: 18, color: '#64748B', textAlign: 'right' },
  demo: { fontFamily: Typography.fontFamily, fontSize: 10, color: '#8B641C', backgroundColor: '#FFF5DC', padding: 9, borderRadius: 10, textAlign: 'right' },
  list: { gap: 12, paddingBottom: 10 },
  card: { padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE9F7', gap: 7 },
  cardHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 4 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1, alignItems: 'flex-end', gap: 2 },
  cardTitle: { fontFamily: Typography.boldFontFamily, fontSize: 13, color: '#102A56', textAlign: 'right' },
  package: { fontFamily: Typography.latinFontFamily, fontSize: 9, color: '#718096', textAlign: 'right', writingDirection: 'ltr' },
  label: { fontFamily: Typography.fontFamily, fontSize: 10, color: '#52667C', textAlign: 'right', marginTop: 3 },
  input: { minHeight: 40, borderRadius: 9, borderWidth: 1, borderColor: '#D2DFED', backgroundColor: '#F8FAFD', paddingHorizontal: 10, paddingVertical: 7, fontFamily: Typography.latinFontFamily, fontSize: 11, color: '#1E293B', textAlign: 'left', writingDirection: 'ltr' },
  url: { minHeight: 48 },
  notes: { minHeight: 65, textAlign: 'right', writingDirection: 'rtl', fontFamily: Typography.fontFamily },
  hint: { fontFamily: Typography.fontFamily, fontSize: 9, lineHeight: 16, color: '#7D8C9E', textAlign: 'right' },
  switchRow: { minHeight: 50, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#EDF2F7', paddingTop: 7 },
  switchCopy: { flex: 1, gap: 2 },
  switchTitle: { fontFamily: Typography.boldFontFamily, fontSize: 11, color: '#344761', textAlign: 'right' },
  saveButton: { minHeight: 42, borderRadius: 10, backgroundColor: '#1769D2', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 5 },
  saveText: { fontFamily: Typography.boldFontFamily, fontSize: 10, color: '#FFFFFF' },
  disabled: { opacity: .45 },
  error: { fontFamily: Typography.fontFamily, fontSize: 10, color: '#B42318', textAlign: 'right', lineHeight: 18 },
  notice: { fontFamily: Typography.fontFamily, fontSize: 10, color: '#1259B5', backgroundColor: '#EAF3FF', padding: 10, borderRadius: 10, textAlign: 'right' },
});
