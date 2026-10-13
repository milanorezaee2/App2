import { type PropsWithChildren, useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type View,
  type ViewProps,
} from 'react-native';

export function KeyboardProvider({ children }: PropsWithChildren) {
  return children;
}

type StickyProps = PropsWithChildren<ViewProps & {
  offset?: { closed?: number; opened?: number };
}>;

/**
 * Moves the whole composer only by its measured overlap with the keyboard.
 * Native adjustResize remains the first line of defence; this measured fallback
 * handles edge-to-edge/OEM keyboards without guessing a fixed keyboard height.
 */
export function KeyboardStickyView({ children, offset, style, onLayout, ...props }: StickyProps) {
  const ref = useRef<View>(null);
  const translateY = useRef(new Animated.Value(offset?.closed ?? 0)).current;
  const keyboardTop = useRef<number | null>(null);
  const animationDuration = useRef(180);

  const alignToKeyboard = useCallback(() => {
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((_x, y, _width, height) => {
        const top = keyboardTop.current;
        const overlap = top == null ? 0 : Math.max(0, y + height - top);
        const destination = top == null ? (offset?.closed ?? 0) : -overlap + (offset?.opened ?? 0);
        Animated.timing(translateY, {
          toValue: destination,
          duration: animationDuration.current,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    });
  }, [offset?.closed, offset?.opened, translateY]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
      keyboardTop.current = event.endCoordinates.screenY;
      animationDuration.current = event.duration || 180;
      alignToKeyboard();
      setTimeout(alignToKeyboard, Platform.OS === 'android' ? 80 : 0);
    });
    const hide = Keyboard.addListener(hideEvent, (event: KeyboardEvent) => {
      keyboardTop.current = null;
      animationDuration.current = event.duration || 160;
      alignToKeyboard();
    });
    return () => { show.remove(); hide.remove(); };
  }, [alignToKeyboard]);

  const handleLayout = (event: LayoutChangeEvent) => {
    onLayout?.(event);
    if (keyboardTop.current != null) alignToKeyboard();
  };

  return (
    <Animated.View
      {...props}
      ref={ref}
      collapsable={false}
      onLayout={handleLayout}
      style={[style, { transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}
