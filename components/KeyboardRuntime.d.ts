import type { PropsWithChildren, ReactNode } from 'react';
import type { ViewProps } from 'react-native';

export function KeyboardProvider(props: PropsWithChildren): ReactNode;
export function KeyboardStickyView(props: PropsWithChildren<ViewProps & {
  offset?: { closed?: number; opened?: number };
}>): ReactNode;
