import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EnglishPalette as Palette } from './EnglishSupplementTask';
import { toPersianDigits as fa } from '@/lib/format';
import type { LearningSentence } from '@/lib/languages/types';
import { Typography } from '@/lib/theme';

function normalizeRussian(value: string) {
  return value.normalize('NFD').replace(/\u0301/g, '').normalize('NFC')
    .toLocaleLowerCase('ru-RU').replace(/[.,!?;:«»"“”()…—-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function rotateTokens(tokens: string[]) {
  if (tokens.length < 2) return tokens;
  const shift = Math.max(1, Math.floor(tokens.length / 2));
  const rotated = [...tokens.slice(shift), ...tokens.slice(0, shift)];
  return rotated.every((token, index) => token === tokens[index]) ? [...tokens].reverse() : rotated;
}

export default function RussianSentenceBuilder({

  sentence,
  lessonSentences,
}: {
  sentence: LearningSentence;
  lessonSentences?: readonly LearningSentence[];
}) {
  const targetTokens = useMemo(
    () => sentence.text.trim().split(/\s+/).filter(Boolean),
    [sentence.text],
  );

  const bankTokens = useMemo(() => {
    const base = [...targetTokens];
    if (lessonSentences?.length && base.length <= 4) {
      const normalizedExisting = new Set(base.map(normalizeRussian));
      for (const item of lessonSentences) {
        if (item.id === sentence.id) continue;
        for (const candidate of item.text.trim().split(/\s+/).filter(Boolean)) {
          const norm = normalizeRussian(candidate);
          if (!norm || normalizedExisting.has(norm)) continue;
          normalizedExisting.add(norm);
          base.push(candidate);
          if (base.length >= Math.min(targetTokens.length + 2, 6)) break;
        }
        if (base.length >= Math.min(targetTokens.length + 2, 6)) break;
      }
    }
    return rotateTokens(base);
  }, [targetTokens, lessonSentences, sentence.id]);

  const [chosen, setChosen] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const built = chosen.map(index => bankTokens[index]).join(' ');
  const complete = chosen.length === targetTokens.length;
  const correct = complete && normalizeRussian(built) === normalizeRussian(sentence.text);

  useEffect(() => {
    setChosen([]);
    setChecked(false);
  }, [sentence.id]);

  const choose = (index: number) => {
    if (chosen.includes(index) || chosen.length >= targetTokens.length) return;
    setChosen(current => [...current, index]);
    setChecked(false);
  };
  const remove = (position: number) => {
    setChosen(current => current.filter((_, index) => index !== position));
    setChecked(false);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>تمرین ساخت جمله بر پایهٔ الگو</Text>
      {sentence.pattern ? (
        <View style={styles.patternBox}>
          <Text style={styles.patternLabel}>الگوی جمله‌سازی</Text>
          <Text style={styles.patternValue}>{sentence.pattern}</Text>
        </View>
      ) : null}
      <Text style={styles.translation}>{sentence.fa}</Text>
      <View accessibilityLabel="جملهٔ ساخته‌شده" style={styles.answerArea}>
        {chosen.length ? chosen.map((tokenIndex, position) => (
          <Pressable
            key={`${tokenIndex}-${position}`}
            accessibilityRole="button"
            accessibilityLabel={`حذف واژه ${bankTokens[tokenIndex]}`}
            onPress={() => remove(position)}
            style={styles.answerChip}
          >
            <Text style={styles.answerText}>{bankTokens[tokenIndex]}</Text>
          </Pressable>
        )) : <Text style={styles.placeholder}>واژه‌ها را طبق الگوی بالا به ترتیب انتخاب کنید ({fa(targetTokens.length)} واژه).</Text>}
      </View>
      <View style={styles.wordBank}>
        {bankTokens.map((word, index) => {
          const used = chosen.includes(index);
          return (
            <Pressable
              key={`${sentence.id}-${index}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: used }}
              disabled={used}
              onPress={() => choose(index)}
              style={[styles.wordChip, used && styles.usedChip]}
            >
              <Text style={[styles.wordText, used && styles.usedText]}>{word}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => setChecked(true)}>
          <Text style={styles.primaryButtonText}>بررسی ترتیب</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => { setChosen([]); setChecked(false); }}>
          <Text style={styles.secondaryButtonText}>از نو</Text>
        </Pressable>
      </View>
      {checked ? (
        <Text accessibilityLiveRegion="polite" style={[styles.feedback, correct ? styles.success : styles.tryAgain]}>
          {correct
            ? 'آفرین! جمله دقیقاً مطابق الگوی جمله‌سازی ساخته شد.'
            : complete
              ? `ترتیب یا انتخاب واژه‌ها را با توجه به الگو بررسی کنید. نمونهٔ درست: ${sentence.text}`
              : `برای کامل‌شدن این جمله ${fa(targetTokens.length - chosen.length)} واژهٔ دیگر انتخاب کنید.`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', backgroundColor: Palette.surface, borderRadius: 20, borderWidth: 1, borderColor: Palette.border, padding: 17, gap: 12 },
  kicker: { fontFamily: Typography.fontFamily, fontSize: 12, lineHeight: 20, fontWeight: '400', color: Palette.primary, textAlign: 'right', writingDirection: 'rtl' },
  patternBox: { width: '100%', borderRadius: 13, backgroundColor: Palette.warningSoft, borderWidth: 1, borderColor: '#F3DEC0', paddingHorizontal: 12, paddingVertical: 9, gap: 3 },
  patternLabel: { fontFamily: Typography.fontFamily, fontSize: 10, fontWeight: '400', color: Palette.warning, textAlign: 'right', writingDirection: 'rtl' },
  patternValue: { fontFamily: Typography.fontFamily, fontSize: 12, lineHeight: 20, fontWeight: '400', color: Palette.ink, textAlign: 'right', writingDirection: 'rtl' },
  translation: { fontFamily: Typography.fontFamily, fontSize: 16, lineHeight: 27, fontWeight: '400', color: Palette.ink, textAlign: 'right', writingDirection: 'rtl' },
  answerArea: { minHeight: 74, borderRadius: 14, borderWidth: 1, borderColor: Palette.primary, backgroundColor: Palette.primarySoft, padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' },
  placeholder: { flex: 1, fontFamily: Typography.fontFamily, fontSize: 11, lineHeight: 19, fontWeight: '400', color: Palette.muted, textAlign: 'right', writingDirection: 'rtl' },
  answerChip: { borderRadius: 10, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.primary, paddingHorizontal: 10, paddingVertical: 8 },
  answerText: { fontFamily: 'Inter-ExtraBold', color: Palette.ink, fontSize: 12, fontWeight: '800', writingDirection: 'ltr' },
  wordBank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8 },
  wordChip: { borderRadius: 11, backgroundColor: Palette.surfaceMuted, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 11, paddingVertical: 9 },
  usedChip: { opacity: .42 },
  wordText: { fontFamily: 'Inter-ExtraBold', color: Palette.ink, fontSize: 12, fontWeight: '800', writingDirection: 'ltr' },
  usedText: { color: Palette.muted },
  actions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  primaryButton: { flex: 1, minHeight: 46, backgroundColor: Palette.primary, borderRadius: 13, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: Typography.fontFamily, color: '#FFFFFF', fontSize: 12, fontWeight: '400', writingDirection: 'rtl' },
  secondaryButton: { minHeight: 46, backgroundColor: Palette.surfaceMuted, borderRadius: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontFamily: Typography.fontFamily, color: Palette.ink, fontSize: 12, fontWeight: '400', writingDirection: 'rtl' },
  feedback: { fontFamily: Typography.fontFamily, fontSize: 12, lineHeight: 20, fontWeight: '400', textAlign: 'right', writingDirection: 'rtl' },
  success: { color: Palette.success },
  tryAgain: { color: Palette.warning },
});
