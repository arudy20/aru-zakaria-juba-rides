// Shared building blocks for the rider and driver apps, following replica/design/components.md.
// Colours, sizes and type come only from the generated theme (tokens.json); no raw values here.
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { theme, type ColorRole, type TypeRole } from './theme';

const c = theme.color;
const s = theme.space; // [0, 4, 8, 12, 16, 24, 32, 48, 64]

// ---------------------------------------------------------------- text
export function Text({
  variant = 'base',
  color = 'text',
  numbers,
  style,
  ...rest
}: TextProps & { variant?: TypeRole; color?: ColorRole; numbers?: boolean }) {
  return (
    <RNText
      {...rest}
      style={[theme.type[variant], { color: c[color] }, numbers && styles.tabular, style]}
    />
  );
}

// ---------------------------------------------------------------- button
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: 'lg' | 'md' | 'sm';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const height = theme.size[`button-${size}`];
  const isDisabled = disabled || loading;
  const bg: Record<ButtonVariant, string> = {
    primary: c.accent,
    secondary: c.surface,
    ghost: 'transparent',
    danger: c.danger,
  };
  const fg: Record<ButtonVariant, ColorRole> = {
    primary: 'on-accent',
    secondary: 'text',
    ghost: 'accent',
    danger: 'on-accent',
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      accessibilityLabel={label}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: height,
          backgroundColor: disabled && !loading ? c.border : bg[variant],
          borderColor: variant === 'secondary' ? c['border-input'] : 'transparent',
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading && <ActivityIndicator color={c[fg[variant]]} />}
      <Text variant="base" color={disabled && !loading ? 'text-muted' : fg[variant]} style={styles.bold}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------- input
export function Field({
  label,
  error,
  hint,
  style,
  ...rest
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text variant="sm" style={styles.bold}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c['text-muted']}
        {...rest}
        style={[
          theme.type.base,
          styles.input,
          { borderColor: error ? c.danger : c['border-input'], borderWidth: error ? 2 : 1 },
          style as StyleProp<TextStyle>,
        ]}
      />
      {error ? (
        <Text variant="sm" color="danger" style={styles.bold} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="xs" color="text-muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- notice
export function Notice({ children, tone = 'notice' }: { children: React.ReactNode; tone?: 'notice' | 'danger' }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: tone === 'danger' ? c.bg : c.notice, borderColor: tone === 'danger' ? c.danger : c.notice }]}
    >
      {typeof children === 'string' ? (
        <Text variant="sm" color={tone === 'danger' ? 'danger' : 'text'}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

// ---------------------------------------------------------------- plate chip
export function PlateChip({ plate }: { plate: string }) {
  return (
    <View style={styles.plate} accessibilityLabel={`Number plate ${plate.split('').join(' ')}`}>
      <Text variant="lg" color="on-ink-panel" numbers style={styles.plateText}>
        {plate}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------- fare display
export function FareDisplay({ amount, currency, caption }: { amount: string; currency: string; caption?: string }) {
  return (
    <View accessible accessibilityLabel={`Fixed fare ${amount} ${currency}`}>
      <View style={styles.fareRow}>
        <Text variant="fare" numbers>
          {amount}
        </Text>
        <Text variant="lg" style={styles.fareCurrency}>
          {currency}
        </Text>
      </View>
      <Text variant="sm" color="success" style={styles.bold}>
        {caption ?? 'Fixed fare. This is what you pay.'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------- bottom sheet (static, sits over the map)
export function Sheet({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sheet, style]}>
      <View style={styles.handle} />
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- selectable card (ride options, payment)
export function OptionCard({
  selected,
  disabled,
  onPress,
  children,
  label,
}: {
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.option,
        selected
          ? { borderColor: c.accent, borderWidth: 2, backgroundColor: c['accent-soft'] }
          : { borderColor: c.border, borderWidth: 1, backgroundColor: c.bg },
        disabled && { opacity: 0.6 },
      ]}
    >
      {children}
    </Pressable>
  );
}

// ---------------------------------------------------------------- map pins
export function PickupPin() {
  return (
    <View style={styles.pickupPin} accessibilityLabel="Pickup">
      <View style={styles.pickupDot} />
    </View>
  );
}
export function DropoffPin() {
  return <View style={styles.dropoffPin} accessibilityLabel="Destination" />;
}
export function DriverDot() {
  return <View style={styles.driverDot} accessibilityLabel="Driver" />;
}

export const ui = { color: c, space: s, radius: theme.radius, size: theme.size };

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  bold: { fontFamily: 'AtkinsonHyperlegible_700Bold' },
  button: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s[2],
    paddingHorizontal: s[5],
  },
  field: { gap: s[1] + 2 },
  input: {
    minHeight: theme.size['touch-min'],
    borderRadius: theme.radius.md,
    paddingHorizontal: s[3] + 2,
    color: c.text,
    backgroundColor: c.bg,
  },
  notice: { borderRadius: theme.radius.md, padding: s[3], borderWidth: 1 },
  plate: {
    backgroundColor: c['ink-panel'],
    borderRadius: theme.radius.sm,
    paddingHorizontal: s[3],
    paddingVertical: s[1] + 2,
    alignSelf: 'flex-start',
  },
  plateText: { letterSpacing: 1 },
  fareRow: { flexDirection: 'row', alignItems: 'baseline', gap: s[1] },
  fareCurrency: { marginLeft: s[1] },
  sheet: {
    backgroundColor: c['surface-raised'],
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingHorizontal: theme.layout['phone-gutter'],
    paddingTop: s[2],
    paddingBottom: s[4],
    gap: s[3],
    shadowColor: c.text,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    width: theme.size['handle-width'],
    height: theme.size['sheet-handle'],
    borderRadius: theme.size['sheet-handle'],
    backgroundColor: c.border,
    alignSelf: 'center',
  },
  option: {
    borderRadius: theme.radius.md,
    padding: s[3],
    minHeight: theme.size['touch-min'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: s[3],
  },
  pickupPin: {
    width: theme.size.pin,
    height: theme.size.pin,
    borderRadius: theme.size.pin / 2,
    backgroundColor: c.pickup,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.bg,
  },
  pickupDot: { width: s[2], height: s[2], borderRadius: s[1], backgroundColor: c.bg },
  dropoffPin: { width: theme.size['pin-dropoff'], height: theme.size['pin-dropoff'], backgroundColor: c.dropoff, borderWidth: 2, borderColor: c.bg },
  driverDot: { width: theme.size['driver-dot'], height: theme.size['driver-dot'], borderRadius: theme.size['driver-dot'] / 2, backgroundColor: c.accent, borderWidth: s[1], borderColor: c.bg },
});
