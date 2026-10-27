import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Typography } from '@/lib/theme';

type Props = { disabled: boolean; loading: boolean; onPress: () => void };

/** Google's standard four-colour G, on a white outlined circular button. */
export function GoogleSignInButton({ disabled, loading, onPress }: Props) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="ادامه با حساب گوگل"
        accessibilityHint="صفحهٔ امن انتخاب حساب گوگل باز می‌شود"
        accessibilityState={{ disabled, busy: loading }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && !loading && styles.disabled]}
      >
        {loading ? <ActivityIndicator size="small" color="#4285F4" /> : (
          <Svg width={23} height={23} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <Path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19z" />
            <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </Svg>
        )}
      </Pressable>
      <Text style={styles.label}>ادامه با گوگل</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 7, marginBottom: 16 },
  button: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#DADCE0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: '#F1F5FF', borderColor: '#4285F4' },
  disabled: { opacity: 0.5 },
  label: { fontFamily: Typography.fontFamily, fontSize: 12, color: '#334155', writingDirection: 'rtl', textAlign: 'center' },
});
