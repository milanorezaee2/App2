import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

export function KeyboardProvider({ children }: PropsWithChildren) {
  return children;
}

export function KeyboardStickyView({ children, ...props }: PropsWithChildren<ViewProps & { offset?: { closed?: number; opened?: number } }>) {
  return <View {...props}>{children}</View>;
}
