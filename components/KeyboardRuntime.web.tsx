import React from 'react';
import { View, type ViewProps } from 'react-native';

export function KeyboardProvider({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}

export function KeyboardStickyView({ children, ...props }: React.PropsWithChildren<ViewProps>) {
  return <View {...props}>{children}</View>;
}

export function KeyboardAvoidingView({ children, ...props }: React.PropsWithChildren<ViewProps & { behavior?: string; enabled?: boolean }>) {
  const { behavior: _behavior, enabled: _enabled, ...viewProps } = props;
  return <View {...viewProps}>{children}</View>;
}
