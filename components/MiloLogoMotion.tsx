import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpenCheck } from 'lucide-react-native';

const LETTERS = ['M', 'i', 'l', 'o'];
const SUBTITLE = 'MULTILANGUAGE';

/**
 * Timing budget.
 *
 * The intro screen lives exactly `INTRO_DURATION_MS` (1200 ms) in `app/_layout.tsx`.
 * Older values finished the animation just before the intro ended, so the app
 * opened while the learner was still reading: only "Milo" had registered and
 * the MULTILANGUAGE line flashed past. The whole brand now finishes at ~615 ms,
 * which leaves ~0.6 s of stillness on "Milo / MULTILANGUAGE" — long enough to
 * read, still far shorter than a second of waiting.
 */
const MARK_MS = 160;
const SHEEN_MS = 260;
const LETTER_STAGGER_MS = 45;
const LETTER_MS = 150;
const TAGLINE_DELAY_MS = 30;
const TAGLINE_MS = 140;

type Props = {
  /** `intro` is the large startup logo; `header` is the compact in-app logo. */
  size?: 'intro' | 'header';
  /** When false, the logo renders fully visible without animating. */
  play?: boolean;
  onDone?: () => void;
};

/** Brand logo: a glossy mark, a light sweep, then the word "Milo" letter by letter. */
export function MiloLogoMotion({ size = 'intro', play = true, onDone }: Props) {
  const isIntro = size === 'intro';
  const markSize = isIntro ? 104 : 40;
  const iconSize = isIntro ? 40 : 18;
  const fontSize = isIntro ? 46 : 22;

  const mark = useRef(new Animated.Value(play ? 0 : 1)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const letters = useRef(LETTERS.map(() => new Animated.Value(play ? 0 : 1))).current;
  const tagline = useRef(new Animated.Value(play ? 0 : 1)).current;
  // Measured so the small subtitle spans exactly the same width as the word "Milo".
  const [wordWidth, setWordWidth] = useState(0);
  const [subtitleNatural, setSubtitleNatural] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!play) return;
    const sequence = Animated.sequence([
      Animated.timing(mark, { toValue: 1, duration: MARK_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(sheen, { toValue: 1, duration: SHEEN_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.stagger(
          LETTER_STAGGER_MS,
          letters.map(value => Animated.timing(value, {
            toValue: 1,
            duration: LETTER_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })),
        ),
      ]),
      Animated.delay(TAGLINE_DELAY_MS),
      Animated.timing(tagline, { toValue: 1, duration: TAGLINE_MS, useNativeDriver: true }),
    ]);
    sequence.start(({ finished }) => { if (finished) doneRef.current?.(); });
    return () => sequence.stop();
    // Plays once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtitleSpacing = wordWidth > 0 && subtitleNatural > 0 ? Math.max(0, (wordWidth - subtitleNatural) / (SUBTITLE.length - 1)) : 0;

  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-markSize, markSize * 1.6] });

  return (
    <View accessibilityRole="image" accessibilityLabel="MiloMultiLanguage" style={[styles.wrap, isIntro ? styles.wrapIntro : styles.wrapHeader]}>
      <Animated.View style={{ opacity: mark, transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }] }}>
        <LinearGradient
          colors={['#2F8BFF', '#1769D2', '#0B3E8F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: markSize, height: markSize, borderRadius: isIntro ? 32 : 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          <BookOpenCheck size={iconSize} color="#FFFFFF" strokeWidth={2.4} />
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -markSize * 0.3,
              bottom: -markSize * 0.3,
              width: markSize * 0.28,
              backgroundColor: 'rgba(255,255,255,0.38)',
              transform: [{ translateX: sheenX }, { rotate: '18deg' }],
            }}
          />
        </LinearGradient>
      </Animated.View>
      <View style={styles.word} onLayout={event => setWordWidth(event.nativeEvent.layout.width)}>
        {LETTERS.map((letter, index) => (
          <Animated.Text
            key={index}
            style={[styles.letter, {
              fontSize,
              opacity: letters[index],
              transform: [{ translateY: letters[index].interpolate({ inputRange: [0, 1], outputRange: [fontSize * 0.45, 0] }) }],
            }]}
          >
            {letter}
          </Animated.Text>
        ))}
      </View>
      {isIntro && (
        <Animated.View style={{ width: wordWidth || undefined, opacity: tagline, alignItems: 'center' }}>
          <Text style={[styles.tagline, { letterSpacing: subtitleSpacing, marginRight: -subtitleSpacing }]}>{SUBTITLE}</Text>
        </Animated.View>
      )}
      {isIntro && (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          onLayout={event => setSubtitleNatural(event.nativeEvent.layout.width)}
          style={[styles.tagline, styles.measureOnly]}
        >
          {SUBTITLE}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  wrapIntro: { flexDirection: 'column', gap: 14 },
  wrapHeader: { flexDirection: 'row', gap: 10 },
  word: { flexDirection: 'row', direction: 'ltr', alignItems: 'center' },
  letter: { fontFamily: 'Inter-ExtraBold', color: '#102A56', letterSpacing: 1.5, writingDirection: 'ltr' },
  tagline: { fontFamily: 'Inter-ExtraBold', fontSize: 10, color: '#6882A6', writingDirection: 'ltr', textAlign: 'center' },
  measureOnly: { position: 'absolute', opacity: 0, letterSpacing: 0 },
});
