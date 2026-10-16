import React from 'react';
import { useWindowDimensions, type ViewProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';

export {
  KeyboardAwareScrollView,
  KeyboardAvoidingView,
  KeyboardProvider,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';

/**
 * Keeps the wrapped block (the chat composer stack) fully above the keyboard
 * by padding exactly the part of the keyboard the system did not already
 * handle:
 *
 * - Android 15+ edge-to-edge: the window no longer resizes for the IME, so
 *   the full animated keyboard height is applied as bottom padding.
 * - Older Android with adjustResize: the window shrink is measured and
 *   subtracted, so the padding never double-avoids.
 * - iOS: the window never resizes, so the full height is applied, animated
 *   on the UI thread together with the keyboard.
 */
export function KeyboardCompensationView({ children, style, ...props }: React.PropsWithChildren<ViewProps>) {
  const { height } = useReanimatedKeyboardAnimation();
  const window = useWindowDimensions();
  const closedWindowHeight = useSharedValue(window.height);
  const currentWindowHeight = useSharedValue(window.height);

  currentWindowHeight.value = window.height;
  if (height.value === 0) {
    closedWindowHeight.value = window.height;
  }

  const compensation = useAnimatedStyle(() => {
    'worklet';
    const systemShrink = Math.max(0, closedWindowHeight.value - currentWindowHeight.value);
    return { paddingBottom: Math.max(0, height.value - systemShrink) };
  });

  return (
    <Animated.View {...props} style={[style, compensation]}>
      {children}
    </Animated.View>
  );
}
