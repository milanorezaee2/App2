/**
 * The opening "situation" stage, shared by the English, German and Russian
 * nine-stage lessons.
 *
 * Russian is the reference design and the learner asked for the other two to
 * match it exactly. The three screens used to differ in small, visible ways:
 * Russian showed the lesson promise and the teaching note directly under the
 * situation text, German showed an extra audio preview card in between, and
 * English showed neither the promise nor the note at all.
 *
 * This component renders the Russian composition for every language, so nothing
 * about *what* is taught changes - only where the same pieces sit on screen.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { toPersianDigits as fa } from '@/lib/format';
import { Typography } from '@/lib/theme';

export type SituationPalette = {
  primary: string;
  primarySoft: string;
  primaryDark: string;
  border: string;
  surface: string;
  text: string;
  warning?: string;
};

export function LessonSituationStage({
  title,
  situation,
  sentenceCount,
  teaching,
  teachingLabel,
  palette,
  maxWidth,
  children,
}: {
  title: string;
  situation: string;
  sentenceCount: number;
  teaching?: string;
  teachingLabel: string;
  palette: SituationPalette;
  maxWidth?: number;
  /** Optional extra block (used by German for its audio preview card). */
  children?: ReactNode;
}) {
  const styles = createStyles(palette, maxWidth);
  return (
    <View style={styles.centerStage}>
      <View style={styles.bigIcon}><Sparkles size={34} color={palette.warning ?? palette.primary} /></View>
      <Text style={styles.stageEyebrow}>موقعیت واقعی</Text>
      <Text style={styles.stageTitle}>{title}</Text>
      <Text style={styles.situation}>{situation}</Text>
      <View style={styles.promiseCard}>
        <Text style={styles.promiseTitle}>در پایان این درس می‌توانید:</Text>
        <Text style={styles.promiseText}>با {fa(sentenceCount)} جملهٔ کوتاه، این موقعیت را مدیریت کنید.</Text>
      </View>
      {teaching ? (
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>{teachingLabel}</Text>
          <Text style={styles.noteText}>{teaching}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function createStyles(palette: SituationPalette, maxWidth?: number) {
  return StyleSheet.create({
    centerStage: {
      width: '100%',
      ...(maxWidth ? { maxWidth, alignSelf: 'center' as const } : null),
      alignItems: 'center',
      gap: 12,
    },
    bigIcon: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: '#F6F1E4',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    stageEyebrow: {
      fontFamily: Typography.fontFamily,
      color: palette.primary,
      fontSize: 12,
      fontWeight: '400',
      textAlign: 'right',
      writingDirection: 'rtl',
      marginTop: 6,
    },
    stageTitle: {
      fontFamily: Typography.fontFamily,
      fontSize: 26,
      fontWeight: '400',
      color: palette.text,
      textAlign: 'center',
      writingDirection: 'rtl',
      lineHeight: 39,
    },
    situation: {
      fontFamily: Typography.fontFamily,
      fontSize: 14,
      lineHeight: 26,
      color: palette.text,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    promiseCard: {
      width: '100%',
      borderRadius: 20,
      backgroundColor: palette.primarySoft,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 18,
      marginTop: 8,
      gap: 5,
    },
    promiseTitle: {
      fontFamily: Typography.fontFamily,
      fontSize: 13,
      fontWeight: '400',
      color: palette.primaryDark,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    promiseText: {
      fontFamily: Typography.fontFamily,
      fontSize: 13,
      color: palette.text,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 23,
      marginTop: 4,
    },
    noteCard: {
      width: '100%',
      marginTop: 6,
      borderRadius: 18,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 17,
      gap: 8,
    },
    noteTitle: {
      fontFamily: Typography.fontFamily,
      color: palette.primaryDark,
      fontSize: 13,
      fontWeight: '400',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    noteText: {
      fontFamily: Typography.fontFamily,
      color: palette.text,
      fontSize: 12,
      lineHeight: 25,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
}
