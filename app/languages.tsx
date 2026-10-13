import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, BookOpenCheck, Check, Headphones, Mic2, Sparkles, Target } from 'lucide-react-native';
import { LANGUAGES } from '@/lib/languages/catalog';
import { FEATURES } from '@/lib/features';

const languageMeta = {
  en: { flag: '🇬🇧', code: 'EN', nativeName: 'English', tint: '#EAF2FF', border: '#CFE0FF' },
  de: { flag: '🇩🇪', code: 'DE', nativeName: 'Deutsch', tint: '#F1F6FF', border: '#D7E4FA' },
  ru: { flag: '🇷🇺', code: 'RU', nativeName: 'Русский', tint: '#EEF4FF', border: '#D5E3FF' },
} as const;

const learningSteps = [
  { icon: Headphones, number: '۰۱', title: 'بشنو', detail: 'جمله را با صدای طبیعی بشنو' },
  { icon: Mic2, number: '۰۲', title: 'تکرار کن', detail: 'با سرعت خودت تمرین کن' },
  { icon: Target, number: '۰۳', title: 'به‌خاطر بسپار', detail: 'با مرور هوشمند تثبیت کن' },
] as const;

export default function LanguagesHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const compact = !ready || width < 680;
  const tiny = !ready || width < 370;
  const languages = LANGUAGES.filter(language => language.id !== 'ru' || FEATURES.russianCourse);

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, compact && styles.pageCompact]}>
          <View style={styles.header}>
            <View style={styles.brand}>
              <View style={styles.brandIcon}>
                <BookOpenCheck size={19} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <View>
                <Text style={styles.brandName}>MILO</Text>
                <Text style={styles.brandCaption}>LANGUAGE LEARNING</Text>
              </View>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>آمادهٔ یادگیری</Text>
            </View>
          </View>

          <LinearGradient
            colors={['#FFFFFF', '#EDF5FF', '#E4F2FF']}
            start={{ x: 0.95, y: 0 }}
            end={{ x: 0.05, y: 1 }}
            style={[styles.hero, compact && styles.heroCompact]}
          >
            <View style={styles.heroOrbOne} />
            <View style={styles.heroOrbTwo} />
            <View style={[styles.heroCopy, compact && styles.heroCopyCompact]}>
              <View style={styles.eyebrow}>
                <Sparkles size={13} color="#1769D2" />
                <Text style={styles.eyebrowText}>یادگیری ساده، پیوسته و واقعی</Text>
              </View>
              <Text accessibilityRole="header" style={[styles.heroTitle, tiny && styles.heroTitleTiny]}>
                هر روز، یک قدم{`\n`}به مکالمه نزدیک‌تر
              </Text>
              <Text style={styles.heroDescription}>
                مسیر کوتاه و شخصی تو برای یادگیری زبان؛ با جمله‌های کاربردی، شنیدن هدفمند و مرور منظم.
              </Text>
              <View style={styles.heroChecks}>
                <View style={styles.checkItem}><Check size={13} color="#087F5B" strokeWidth={3} /><Text style={styles.checkText}>بدون حفظ‌کردن بی‌هدف</Text></View>
                <View style={styles.checkItem}><Check size={13} color="#087F5B" strokeWidth={3} /><Text style={styles.checkText}>پیشرفت ذخیره‌شونده</Text></View>
              </View>
            </View>
            <View style={[styles.heroVisual, compact && styles.heroVisualCompact]}>
              <Image source={require('../assets/images/splash-learning-light.png')} resizeMode="contain" style={styles.heroImage} />
            </View>
          </LinearGradient>

          <View style={styles.languageSection}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>CHOOSE A LANGUAGE</Text>
              <Text style={styles.sectionTitle}>می‌خواهی کدام زبان را یاد بگیری؟</Text>
              <Text style={styles.sectionDetail}>برای ورود، یکی از زبان‌ها را انتخاب کن.</Text>
            </View>

            <View style={styles.languageRow}>
              {languages.map(language => {
                const meta = languageMeta[language.id as keyof typeof languageMeta];
                return (
                  <Pressable
                    key={language.id}
                    accessibilityRole="button"
                    accessibilityLabel={`ورود به زبان ${language.name}`}
                    onPress={() => router.push(language.home as never)}
                    style={({ pressed }) => [
                      styles.languageCard,
                      { backgroundColor: meta.tint, borderColor: meta.border },
                      tiny && styles.languageCardTiny,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.flag}>{meta.flag}</Text>
                    <View style={styles.languageIdentity}>
                      <Text style={styles.languageCode}>{meta.code}</Text>
                      <Text style={styles.languageName} numberOfLines={1}>{meta.nativeName}</Text>
                    </View>
                    <View style={styles.languageArrow}><ArrowLeft size={14} color="#1769D2" strokeWidth={2.5} /></View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.flowCard}>
            <View style={styles.flowHeader}>
              <View>
                <Text style={styles.flowEyebrow}>روش یادگیری میلو</Text>
                <Text style={styles.flowTitle}>یک چرخهٔ کوتاه برای پیشرفت واقعی</Text>
              </View>
              <View style={styles.minutesBadge}><Text style={styles.minutesValue}>۱۰</Text><Text style={styles.minutesText}>دقیقه در روز</Text></View>
            </View>
            <View style={styles.stepsRow}>
              {learningSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <View key={step.number} style={styles.stepWrap}>
                    <View style={styles.step}>
                      <View style={styles.stepIcon}><Icon size={18} color="#1769D2" /></View>
                      <Text style={styles.stepNumber}>{step.number}</Text>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepDetail}>{step.detail}</Text>
                    </View>
                    {index < learningSteps.length - 1 ? <View style={styles.connector} /> : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>آماده‌ای شروع کنی؟ زبانت را انتخاب کن و اولین درس را بساز.</Text>
            <Text style={styles.footerBrand}>MILO · LEARN A LITTLE, EVERY DAY</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7FAFF' },
  scrollContent: { flexGrow: 1, paddingBottom: 28 },
  page: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 26, paddingTop: 52, gap: 22 },
  pageCompact: { paddingHorizontal: 15, paddingTop: 42, gap: 17 },
  header: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  brandIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#1769D2', alignItems: 'center', justifyContent: 'center', shadowColor: '#1769D2', shadowOpacity: .2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  brandName: { color: '#102A56', fontSize: 18, lineHeight: 20, fontWeight: '900', textAlign: 'right', letterSpacing: 2, writingDirection: 'ltr' },
  brandCaption: { color: '#6680A5', fontSize: 7, fontWeight: '800', letterSpacing: 1.35, writingDirection: 'ltr' },
  statusPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F8' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22A06B' },
  statusText: { fontFamily: 'Vazirmatn-Bold', color: '#49617F', fontSize: 10, fontWeight: '700', writingDirection: 'rtl' },
  hero: { minHeight: 290, borderRadius: 28, borderWidth: 1, borderColor: '#D4E5FA', overflow: 'hidden', flexDirection: 'row-reverse', alignItems: 'center', padding: 30, shadowColor: '#18529A', shadowOpacity: .08, shadowRadius: 22, shadowOffset: { width: 0, height: 9 }, elevation: 3 },
  heroCompact: { minHeight: 330, padding: 21, alignItems: 'flex-start' },
  heroOrbOne: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(79,160,255,0.12)', top: -72, right: -38 },
  heroOrbTwo: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(74,216,224,0.13)', bottom: -55, left: 40 },
  heroCopy: { flex: 1, zIndex: 2, alignItems: 'flex-end', gap: 12, maxWidth: 610 },
  heroCopyCompact: { paddingTop: 3, paddingBottom: 110 },
  eyebrow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.84)', borderWidth: 1, borderColor: '#D5E6FA' },
  eyebrowText: { fontFamily: 'Vazirmatn-Bold', color: '#1769D2', fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  heroTitle: { fontFamily: 'Vazirmatn-Bold', color: '#102A56', fontSize: 34, lineHeight: 49, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  heroTitleTiny: { fontSize: 29, lineHeight: 43 },
  heroDescription: { maxWidth: 580, fontFamily: 'Vazirmatn', color: '#4D6688', fontSize: 14, lineHeight: 25, fontWeight: '500', textAlign: 'right', writingDirection: 'rtl' },
  heroChecks: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 9 },
  checkItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  checkText: { fontFamily: 'Vazirmatn-Bold', color: '#315274', fontSize: 11, fontWeight: '700', writingDirection: 'rtl' },
  heroVisual: { width: '36%', height: 235, alignItems: 'center', justifyContent: 'center' },
  heroVisualCompact: { position: 'absolute', width: 138, height: 138, left: 10, bottom: -3, opacity: .98 },
  heroImage: { width: '100%', height: '100%' },
  languageSection: { gap: 13, paddingTop: 4 },
  sectionCopy: { alignItems: 'flex-end', gap: 3 },
  sectionEyebrow: { color: '#1769D2', fontSize: 9, fontWeight: '900', letterSpacing: 1.25, writingDirection: 'ltr' },
  sectionTitle: { fontFamily: 'Vazirmatn-Bold', color: '#102A56', fontSize: 21, lineHeight: 31, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  sectionDetail: { fontFamily: 'Vazirmatn', color: '#6A7F9B', fontSize: 12, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },
  languageRow: { flexDirection: 'row-reverse', gap: 10, alignItems: 'stretch' },
  languageCard: { flex: 1, minWidth: 0, maxWidth: 190, minHeight: 92, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#174B86', shadowOpacity: .045, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  languageCardTiny: { minHeight: 84, paddingHorizontal: 7, paddingVertical: 9, borderRadius: 15 },
  flag: { fontSize: 27, lineHeight: 33 },
  languageIdentity: { alignItems: 'center', gap: 0 },
  languageCode: { color: '#102A56', fontSize: 14, lineHeight: 17, fontWeight: '900', letterSpacing: 1.2, writingDirection: 'ltr' },
  languageName: { color: '#6680A5', fontSize: 9, lineHeight: 12, fontWeight: '700', writingDirection: 'ltr' },
  languageArrow: { position: 'absolute', left: 8, bottom: 8, width: 23, height: 23, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.8)', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: .82, transform: [{ scale: .98 }] },
  flowCard: { borderRadius: 24, padding: 20, gap: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F8', shadowColor: '#174B86', shadowOpacity: .05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  flowHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  flowEyebrow: { fontFamily: 'Vazirmatn-Bold', color: '#1769D2', fontSize: 10, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  flowTitle: { fontFamily: 'Vazirmatn-Bold', color: '#102A56', fontSize: 16, lineHeight: 25, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  minutesBadge: { minWidth: 64, borderRadius: 14, backgroundColor: '#EAF3FF', borderWidth: 1, borderColor: '#D3E5FC', paddingVertical: 7, alignItems: 'center' },
  minutesValue: { color: '#1769D2', fontSize: 17, lineHeight: 19, fontWeight: '900' },
  minutesText: { fontFamily: 'Vazirmatn-Bold', color: '#6680A5', fontSize: 8, fontWeight: '700', writingDirection: 'rtl' },
  stepsRow: { flexDirection: 'row-reverse', alignItems: 'flex-start' },
  stepWrap: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center' },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  stepIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: '#EDF5FF', borderWidth: 1, borderColor: '#D7E7FA', alignItems: 'center', justifyContent: 'center' },
  stepNumber: { color: '#8AA1BE', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  stepTitle: { fontFamily: 'Vazirmatn-Bold', color: '#18385F', fontSize: 12, lineHeight: 18, fontWeight: '900', writingDirection: 'rtl' },
  stepDetail: { maxWidth: 100, fontFamily: 'Vazirmatn', color: '#7186A0', fontSize: 9, lineHeight: 15, textAlign: 'center', writingDirection: 'rtl' },
  connector: { width: 18, height: 1, marginTop: 19, backgroundColor: '#C9DCF4' },
  footer: { paddingVertical: 8, alignItems: 'center', gap: 5 },
  footerText: { fontFamily: 'Vazirmatn', color: '#627B9B', fontSize: 11, lineHeight: 20, textAlign: 'center', writingDirection: 'rtl' },
  footerBrand: { color: '#A0B2C9', fontSize: 7, fontWeight: '900', letterSpacing: 1.1, writingDirection: 'ltr' },
});
