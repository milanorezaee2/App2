import { useEffect, useState } from 'react';
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Award,
  BookOpenCheck,
  Check,
  ChevronLeft,
  Clock3,
  Globe2,
  Headphones,
  Layers3,
  Mic2,
  ShieldCheck,
  Sparkles,
  Star,
  Volume2,
} from 'lucide-react-native';
import { LANGUAGES } from '@/lib/languages/catalog';
import { FEATURES } from '@/lib/features';
import { COURSE_LEVELS, SENTENCE_LESSONS } from '@/lib/courseContent';
import { GERMAN_SENTENCE_LESSONS, germanSentenceLevelMetrics } from '@/lib/languages/germanSentenceCourse';
import { toPersianDigits as fa } from '@/lib/format';

const activeLanguages = LANGUAGES.filter(language => language.id !== 'ru' || FEATURES.russianCourse);
const totalEnglishSentences = SENTENCE_LESSONS.reduce((total, lesson) => total + lesson.sentences.length, 0);
const totalGermanSentences = GERMAN_SENTENCE_LESSONS.reduce((total, lesson) => total + lesson.sentences.length, 0);
const totalLessons = SENTENCE_LESSONS.length + GERMAN_SENTENCE_LESSONS.length;
const totalSentences = totalEnglishSentences + totalGermanSentences;

const coursePresentation = {
  en: {
    code: 'EN',
    nativeName: 'English',
    eyebrow: 'ENGLISH PATH',
    colors: ['#38206B', '#6743C7', '#9A72EC'] as const,
    glow: '#B895FF',
    image: require('../assets/english-learning-hero.jpg') as ImageSourcePropType,
    levels: `${fa(COURSE_LEVELS.length)} مرحله`,
    lessons: `${fa(SENTENCE_LESSONS.length)} درس`,
    sentences: `${fa(totalEnglishSentences)} جمله`,
    detail: 'از پایه تا مکالمهٔ پیشرفته، با جمله‌های واقعی و مرور هوشمند',
    duration: '۵ تا ۱۲ دقیقه',
    placement: 'تعیین سطح انگلیسی',
  },
  de: {
    code: 'DE',
    nativeName: 'Deutsch',
    eyebrow: 'DEUTSCH PATH',
    colors: ['#0F423B', '#167467', '#45AA8F'] as const,
    glow: '#79E2C3',
    image: require('../assets/german-learning-hero.jpg') as ImageSourcePropType,
    levels: `${fa(4)} مرحله`,
    lessons: `${fa(GERMAN_SENTENCE_LESSONS.length)} درس`,
    sentences: `${fa(totalGermanSentences)} جمله`,
    detail: 'مسیر جمله‌محور Pre-A1 تا B1 با تلفظ، واژگان و مکالمه',
    duration: '۵ تا ۱۰ دقیقه',
    placement: 'تعیین سطح آلمانی',
  },
  ru: {
    code: 'RU',
    nativeName: 'Русский',
    eyebrow: 'RUSSIAN PATH',
    colors: ['#263A68', '#4267A8', '#7899D0'] as const,
    glow: '#A9C6FF',
    image: require('../assets/language-learning-hero.jpg') as ImageSourcePropType,
    levels: `${fa(5)} مرحله`,
    lessons: 'مسیر آغازین',
    sentences: 'تمرین جمله‌محور',
    detail: 'شروع قدم‌به‌قدم با خط سیریلیک و جمله‌های کاربردی',
    duration: '۵ تا ۱۰ دقیقه',
    placement: 'شروع مسیر روسی',
  },
} as const;

const proofItems = [
  { value: `${fa(activeLanguages.length)}`, label: 'مسیر فعال' },
  { value: fa(totalLessons), label: 'درس ساختاریافته' },
  { value: fa(totalSentences), label: 'جملهٔ واقعی' },
  { value: 'آفلاین', label: 'حفظ پیشرفت' },
] as const;

const features = [
  { icon: Volume2, title: 'صدای طبیعی', detail: 'سرعت عادی و تمرین آهسته', color: '#BBA1FF', soft: 'rgba(132,94,220,0.15)' },
  { icon: BookOpenCheck, title: 'مسیر روشن', detail: 'درس کوتاه و مرحله‌بندی‌شده', color: '#77D8BC', soft: 'rgba(59,176,145,0.14)' },
  { icon: Award, title: 'مرور ماندگار', detail: 'تکرار هوشمند بر اساس پیشرفت', color: '#F2C879', soft: 'rgba(220,164,64,0.14)' },
] as const;

export default function LanguagesHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const compact = !hydrated || width < 720;
  const tiny = !hydrated || width < 390;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.page, compact && styles.pageCompact]}
      >
        <View style={styles.shell}>
          <View style={styles.topbar}>
            <View style={styles.brandLockup}>
              <LinearGradient colors={['#A887FF', '#6544D0']} style={styles.brandMark}>
                <Globe2 size={22} color="#FFFFFF" strokeWidth={1.8} />
                <Sparkles size={10} color="#FFE7A7" fill="#FFE7A7" style={styles.brandSpark} />
              </LinearGradient>
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>LANGUAGE JOURNEY</Text>
                <Text style={styles.brandFa}>آموزش زبان، طراحی‌شده برای پیشرفت واقعی</Text>
              </View>
            </View>
            <View style={styles.premiumBadge}>
              <Star size={12} color="#F5CD79" fill="#F5CD79" />
              <Text style={styles.premiumText}>PREMIUM LEARNING</Text>
            </View>
          </View>

          <LinearGradient
            colors={['#171229', '#241A43', '#34245B']}
            start={{ x: .92, y: .02 }}
            end={{ x: .05, y: 1 }}
            style={[styles.hero, compact && styles.heroCompact]}
          >
            <View style={styles.heroGlowOne} pointerEvents="none" />
            <View style={styles.heroGlowTwo} pointerEvents="none" />
            <View style={[styles.heroContent, compact && styles.heroContentCompact]}>
              <View style={styles.heroEyebrow}>
                <View style={styles.liveDot} />
                <Text style={styles.heroEyebrowText}>یک مسیر شخصی برای هر زبان‌آموز</Text>
              </View>
              <Text accessibilityRole="header" style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
                زبان تازه،{`\n`}نسخهٔ تازه‌ای از تو.
              </Text>
              <Text style={styles.heroDescription}>
                با جمله‌های واقعی، شنیدن هدفمند و تمرین‌های کوتاه پیش برو؛ بدون شلوغی، بدون حفظ‌کردن بی‌هدف.
              </Text>
              <View style={styles.heroHighlights}>
                <View style={styles.heroHighlight}><Check size={13} color="#8BE0C5" /><Text style={styles.heroHighlightText}>محتوای جمله‌محور</Text></View>
                <View style={styles.heroHighlight}><Check size={13} color="#8BE0C5" /><Text style={styles.heroHighlightText}>پیشرفت ذخیره‌شونده</Text></View>
              </View>
            </View>
            <View style={[styles.heroArt, compact && styles.heroArtCompact]} pointerEvents="none">
              <View style={styles.heroArtHalo} />
              <Image source={require('../assets/images/splash-learning.png')} resizeMode="cover" style={[styles.heroImage, compact && styles.heroImageCompact]} />
              <View style={styles.heroArtBadge}>
                <Headphones size={14} color="#FFFFFF" />
                <Text style={styles.heroArtBadgeText}>بشنو · تکرار کن · پیش برو</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionEyebrow}>SELECT YOUR PATH</Text>
              <Text style={styles.sectionTitle}>مسیر یادگیری خودت را انتخاب کن</Text>
              <Text style={styles.sectionDescription}>هر مسیر مستقل است و پیشرفت آن جداگانه ذخیره می‌شود.</Text>
            </View>
            <View style={styles.pathCount}><Layers3 size={15} color="#9B81E8" /><Text style={styles.pathCountText}>{fa(activeLanguages.length)} مسیر حرفه‌ای</Text></View>
          </View>

          <View style={styles.courseRow}>
            {activeLanguages.map(language => {
              const presentation = coursePresentation[language.id as keyof typeof coursePresentation];
              return (
                <View key={language.id} style={styles.courseCard}>
                  <LinearGradient colors={presentation.colors} style={styles.courseCover}>
                    <Image source={presentation.image} resizeMode="cover" style={styles.courseImage} />
                    <LinearGradient colors={['rgba(8,8,20,0.02)', 'rgba(8,8,20,0.70)']} style={styles.courseShade} />
                    <View style={styles.courseCoverTop}>
                      <View style={styles.codeBadge}><Text style={styles.codeText}>{presentation.code}</Text></View>
                      <Text style={styles.courseEyebrow}>{presentation.eyebrow}</Text>
                    </View>
                    <View style={styles.courseCoverBottom}>
                      <Text style={styles.courseNative}>{presentation.nativeName}</Text>
                      <Text style={styles.courseName}>{language.name}</Text>
                    </View>
                  </LinearGradient>

                  <View style={[styles.courseBody, tiny && styles.courseBodyTiny]}>
                    <Text style={styles.courseDetail} numberOfLines={3}>{presentation.detail}</Text>
                    <View style={styles.metricGrid}>
                      <View style={styles.metric}><Layers3 size={13} color={presentation.glow} /><Text style={styles.metricText}>{presentation.levels}</Text></View>
                      <View style={styles.metric}><BookOpenCheck size={13} color={presentation.glow} /><Text style={styles.metricText}>{presentation.lessons}</Text></View>
                      <View style={styles.metric}><Mic2 size={13} color={presentation.glow} /><Text style={styles.metricText}>{presentation.sentences}</Text></View>
                      <View style={styles.metric}><Clock3 size={13} color={presentation.glow} /><Text style={styles.metricText}>{presentation.duration}</Text></View>
                    </View>
                    <View style={styles.cardDivider} />
                    <View style={styles.courseAssurance}>
                      <ShieldCheck size={13} color="#71C9AE" />
                      <Text style={styles.courseAssuranceText}>پیشرفت مستقل و محفوظ</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`ورود به مسیر ${language.name}`}
                      onPress={() => router.push(language.home as never)}
                      style={({ pressed }) => [styles.enterButton, { backgroundColor: presentation.glow }, pressed && styles.pressed]}
                    >
                      <Text style={styles.enterButtonText}>ورود به مسیر</Text>
                      <ArrowLeft size={16} color="#151220" />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={presentation.placement}
                      onPress={() => language.id === 'ru'
                        ? router.push(language.home as never)
                        : router.push({ pathname: '/placement', params: { language: language.id } } as never)}
                      style={({ pressed }) => [styles.placementButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.placementText}>{presentation.placement}</Text>
                      <ChevronLeft size={14} color="#B9ACD7" />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.proofStrip}>
            {proofItems.map((item, index) => (
              <View key={item.label} style={styles.proofItem}>
                <Text style={styles.proofValue}>{item.value}</Text>
                <Text style={styles.proofLabel}>{item.label}</Text>
                {index < proofItems.length - 1 ? <View style={styles.proofDivider} /> : null}
              </View>
            ))}
          </View>

          <View style={styles.featureSection}>
            <View style={styles.featureHeading}>
              <Sparkles size={16} color="#A98AF8" />
              <View style={styles.featureHeadingCopy}>
                <Text style={styles.featureTitle}>کمتر شلوغ، بیشتر مؤثر</Text>
                <Text style={styles.featureSubtitle}>ابزارهایی که واقعاً به یادگیری کمک می‌کنند.</Text>
              </View>
            </View>
            <View style={[styles.featureRow, compact && styles.featureRowCompact]}>
              {features.map(feature => {
                const Icon = feature.icon;
                return (
                  <View key={feature.title} style={styles.featureCard}>
                    <View style={[styles.featureIcon, { backgroundColor: feature.soft }]}><Icon size={20} color={feature.color} /></View>
                    <View style={styles.featureCopy}><Text style={styles.featureCardTitle}>{feature.title}</Text><Text style={styles.featureDetail}>{feature.detail}</Text></View>
                  </View>
                );
              })}
            </View>
          </View>

          <LinearGradient colors={['#22183D', '#302052']} style={styles.closingCard}>
            <View style={styles.closingIcon}><Globe2 size={23} color="#DCCEFF" /></View>
            <View style={styles.closingCopy}>
              <Text style={styles.closingTitle}>آماده‌ای اولین جمله را بسازی؟</Text>
              <Text style={styles.closingText}>یک مسیر را انتخاب کن؛ ادامهٔ راه قدم‌به‌قدم برایت روشن می‌شود.</Text>
            </View>
            <Pressable onPress={() => router.push(activeLanguages[0]?.home as never)} style={({ pressed }) => [styles.closingButton, pressed && styles.pressed]}>
              <Text style={styles.closingButtonText}>شروع یادگیری</Text>
              <ChevronLeft size={17} color="#5B3CB8" />
            </Pressable>
          </LinearGradient>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>LANGUAGE JOURNEY</Text>
            <Text style={styles.footerText}>یادگیری کوتاه، واقعی و پیوسته</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B16' },
  page: { flexGrow: 1, paddingHorizontal: 34, paddingTop: 50, paddingBottom: 42, backgroundColor: '#0D0B16' },
  pageCompact: { paddingHorizontal: 14, paddingTop: 44, paddingBottom: 34 },
  shell: { width: '100%', maxWidth: 1080, alignSelf: 'center' },
  topbar: { minHeight: 56, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  brandLockup: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  brandMark: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', shadowColor: '#8D6AF0', shadowOpacity: .28, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  brandSpark: { position: 'absolute', top: -3, right: -3 },
  brandCopy: { flex: 1, alignItems: 'flex-end' },
  brandName: { color: '#F4F0FF', fontSize: 15, fontWeight: '900', letterSpacing: 1.2, textAlign: 'right', writingDirection: 'ltr' },
  brandFa: { fontFamily: 'Vazirmatn-Bold', color: '#9189A6', fontSize: 10, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  premiumBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#171321', borderWidth: 1, borderColor: '#302841' },
  premiumText: { color: '#CFC3E8', fontSize: 8, fontWeight: '800', letterSpacing: 1, writingDirection: 'ltr' },

  hero: { minHeight: 330, borderRadius: 30, borderWidth: 1, borderColor: '#49386D', overflow: 'hidden', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 30, paddingVertical: 24, shadowColor: '#000000', shadowOpacity: .28, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 5 },
  heroCompact: { minHeight: 0, borderRadius: 24, paddingHorizontal: 18, paddingTop: 21, paddingBottom: 15, flexDirection: 'column', alignItems: 'stretch', gap: 7 },
  heroGlowOne: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -155, right: '22%', backgroundColor: 'rgba(165,122,255,0.14)' },
  heroGlowTwo: { position: 'absolute', width: 250, height: 250, borderRadius: 125, bottom: -160, left: -60, backgroundColor: 'rgba(72,206,173,0.10)' },
  heroContent: { flex: 1, alignItems: 'flex-end', gap: 11, zIndex: 2 },
  heroContentCompact: { width: '100%' },
  heroEyebrow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#70D5B7' },
  heroEyebrowText: { fontFamily: 'Vazirmatn-Bold', color: '#CFC5E5', fontSize: 11, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  heroTitle: { fontFamily: 'Vazirmatn-Bold', color: '#FFFFFF', fontSize: 39, lineHeight: 54, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch' },
  heroTitleCompact: { fontSize: 29, lineHeight: 41 },
  heroDescription: { maxWidth: 510, fontFamily: 'Vazirmatn-Bold', color: '#C8BFD9', fontSize: 14, lineHeight: 25, textAlign: 'right', writingDirection: 'rtl' },
  heroHighlights: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  heroHighlight: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  heroHighlightText: { fontFamily: 'Vazirmatn-Bold', color: '#EEE9F8', fontSize: 11, fontWeight: '700', writingDirection: 'rtl' },
  heroArt: { width: 290, height: 280, alignItems: 'center', justifyContent: 'center' },
  heroArtCompact: { width: '100%', height: 190 },
  heroArtHalo: { position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: 'rgba(206,186,255,0.20)', backgroundColor: 'rgba(255,255,255,0.03)' },
  heroImage: { width: 225, height: 225, borderRadius: 38, opacity: .96 },
  heroImageCompact: { width: 170, height: 170, borderRadius: 30 },
  heroArtBadge: { position: 'absolute', bottom: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(21,16,38,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  heroArtBadgeText: { fontFamily: 'Vazirmatn-Bold', color: '#F4F0FC', fontSize: 10, fontWeight: '700', writingDirection: 'rtl' },

  sectionHeader: { marginTop: 28, marginBottom: 14, flexDirection: 'row-reverse', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionHeaderCopy: { flex: 1, alignItems: 'flex-end', gap: 3 },
  sectionEyebrow: { color: '#9A83D8', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, writingDirection: 'ltr' },
  sectionTitle: { fontFamily: 'Vazirmatn-Bold', color: '#F4F0FB', fontSize: 22, lineHeight: 31, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  sectionDescription: { fontFamily: 'Vazirmatn-Bold', color: '#8E879C', fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  pathCount: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#17131F', borderWidth: 1, borderColor: '#2A2338' },
  pathCountText: { fontFamily: 'Vazirmatn-Bold', color: '#B8AEC9', fontSize: 10, fontWeight: '700', writingDirection: 'rtl' },

  courseRow: { flexDirection: 'row-reverse', alignItems: 'stretch', gap: 10 },
  courseCard: { flex: 1, minWidth: 0, borderRadius: 23, overflow: 'hidden', backgroundColor: '#15121D', borderWidth: 1, borderColor: '#30293B', shadowColor: '#000000', shadowOpacity: .20, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  courseCover: { height: 175, padding: 13, justifyContent: 'space-between', overflow: 'hidden' },
  courseImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  courseShade: { ...StyleSheet.absoluteFillObject },
  courseCoverTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  codeBadge: { minWidth: 34, height: 30, paddingHorizontal: 7, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,8,19,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  codeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', writingDirection: 'ltr' },
  courseEyebrow: { flexShrink: 1, color: 'rgba(255,255,255,0.78)', fontSize: 8, fontWeight: '900', letterSpacing: .8, textAlign: 'left', writingDirection: 'ltr' },
  courseCoverBottom: { alignItems: 'flex-end' },
  courseNative: { color: '#FFFFFF', fontSize: 22, lineHeight: 28, fontWeight: '900', textAlign: 'right', writingDirection: 'ltr' },
  courseName: { fontFamily: 'Vazirmatn-Bold', color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  courseBody: { padding: 14, gap: 10 },
  courseBodyTiny: { paddingHorizontal: 10, paddingVertical: 12, gap: 8 },
  courseDetail: { minHeight: 59, fontFamily: 'Vazirmatn-Bold', color: '#B8B0C3', fontSize: 11, lineHeight: 19, fontWeight: '600', textAlign: 'right', writingDirection: 'rtl' },
  metricGrid: { gap: 7 },
  metric: { minHeight: 24, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  metricText: { flex: 1, fontFamily: 'Vazirmatn-Bold', color: '#E5DFEC', fontSize: 10, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  cardDivider: { height: 1, backgroundColor: '#2A2433' },
  courseAssurance: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  courseAssuranceText: { flex: 1, fontFamily: 'Vazirmatn-Bold', color: '#8FC9B8', fontSize: 9, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  enterButton: { minHeight: 44, paddingHorizontal: 11, borderRadius: 13, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  enterButtonText: { flex: 1, fontFamily: 'Vazirmatn-Bold', color: '#151220', fontSize: 11, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  placementButton: { minHeight: 36, paddingHorizontal: 8, borderRadius: 11, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#332B40', backgroundColor: '#19151F' },
  placementText: { flex: 1, fontFamily: 'Vazirmatn-Bold', color: '#B9ACD7', fontSize: 9, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: .78, transform: [{ scale: .99 }] },

  proofStrip: { marginTop: 14, minHeight: 78, flexDirection: 'row-reverse', alignItems: 'center', borderRadius: 20, backgroundColor: '#14111B', borderWidth: 1, borderColor: '#2A2434', paddingVertical: 12 },
  proofItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  proofValue: { color: '#F0EAF9', fontSize: 14, lineHeight: 20, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  proofLabel: { fontFamily: 'Vazirmatn-Bold', color: '#827A90', fontSize: 9, textAlign: 'center', writingDirection: 'rtl' },
  proofDivider: { position: 'absolute', left: 0, top: 7, bottom: 7, width: 1, backgroundColor: '#2C2636' },

  featureSection: { marginTop: 24, gap: 12 },
  featureHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  featureHeadingCopy: { flex: 1, alignItems: 'flex-end' },
  featureTitle: { fontFamily: 'Vazirmatn-Bold', color: '#F2EDF8', fontSize: 19, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  featureSubtitle: { fontFamily: 'Vazirmatn-Bold', color: '#87808F', fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  featureRow: { flexDirection: 'row-reverse', gap: 10 },
  featureRowCompact: { gap: 7 },
  featureCard: { flex: 1, minWidth: 0, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 12, borderRadius: 17, backgroundColor: '#15121C', borderWidth: 1, borderColor: '#2B2535' },
  featureIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1, alignItems: 'flex-end', gap: 2 },
  featureCardTitle: { fontFamily: 'Vazirmatn-Bold', color: '#EAE4F2', fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  featureDetail: { fontFamily: 'Vazirmatn-Bold', color: '#81798C', fontSize: 9, lineHeight: 15, textAlign: 'right', writingDirection: 'rtl' },

  closingCard: { marginTop: 18, minHeight: 92, borderRadius: 21, borderWidth: 1, borderColor: '#463666', padding: 15, flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  closingIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  closingCopy: { flex: 1, alignItems: 'flex-end', gap: 2 },
  closingTitle: { fontFamily: 'Vazirmatn-Bold', color: '#F5F0FC', fontSize: 13, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  closingText: { fontFamily: 'Vazirmatn-Bold', color: '#B5ABC6', fontSize: 10, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  closingButton: { minHeight: 40, paddingHorizontal: 11, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#E8DDFF' },
  closingButtonText: { fontFamily: 'Vazirmatn-Bold', color: '#5B3CB8', fontSize: 10, fontWeight: '900', writingDirection: 'rtl' },
  footer: { marginTop: 22, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#211C2A', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footerBrand: { color: '#6F657C', fontSize: 9, fontWeight: '900', letterSpacing: 1, writingDirection: 'ltr' },
  footerText: { fontFamily: 'Vazirmatn-Bold', color: '#675F71', fontSize: 9, writingDirection: 'rtl' },
});
