import React from 'react';
import {useSrdStyles, useSrdTheme, type SrdTheme} from './theme';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {type Organization} from './api';

function Button({label, onPress, disabled, secondary = false}: {
  label: string; onPress: () => void; disabled: boolean; secondary?: boolean;
}) {
  const styles = useSrdStyles(createStyles);
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

export function SwitchOrganizationScreen({current, code, target, accepted, busy, required, unconfirmed,
  onCode, onFind, onAccepted, onSwitch, onCheck, onBack, onLogout}: {
  current: Organization; code: string; target: Organization | null; accepted: boolean;
  busy: boolean; required: boolean; unconfirmed: boolean;
  onCode: (value: string) => void; onFind: () => void; onAccepted: (value: boolean) => void;
  onSwitch: () => void; onCheck: () => void; onBack: () => void; onLogout: () => void;
}) {
  const theme = useSrdTheme();
  const styles = useSrdStyles(createStyles);
  return <>
    <Text style={styles.eyebrow}>CONTEXTO DE TRABAJO</Text>
    <Text style={styles.title}>{required ? 'Términos actualizados' : 'Cambiar de junta'}</Text>
    <Text style={styles.help}>{required
      ? `Los términos de ${current.name} cambiaron. Léelos y acéptalos para continuar.`
      : `Trabajas en ${current.name}. Solo puedes cambiar a una junta autorizada para tu cuenta.`}</Text>
    {!required && !unconfirmed && <View style={styles.card}>
      <Text style={styles.label}>Código de la junta destino</Text>
      <TextInput accessibilityLabel="Código de junta destino" value={code} onChangeText={onCode}
        autoCapitalize="none" autoCorrect={false} style={styles.input} placeholderTextColor={theme.colors.placeholder} editable={!busy} />
      <Button label="Cargar términos" onPress={onFind} disabled={busy} />
    </View>}
    {required && !unconfirmed && <Button label="Actualizar términos" onPress={onFind} disabled={busy} secondary />}
    {target && !unconfirmed && <View style={styles.card}>
      <Text style={styles.heading}>Términos de {target.name} · versión {target.terms.version}</Text>
      <Text style={styles.terms}>{target.terms.body}</Text>
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked: accepted, disabled: busy}}
        onPress={() => onAccepted(!accepted)} disabled={busy} style={styles.checkbox}>
        <Text style={styles.mark}>{accepted ? '☑' : '□'}</Text>
        <Text style={styles.label}>Acepto los términos vigentes de {target.name}</Text>
      </Pressable>
      <Button label={required ? 'Aceptar y continuar' : 'Aceptar y cambiar de junta'}
        onPress={onSwitch} disabled={busy || !accepted} />
    </View>}
    {unconfirmed && <View style={styles.card}>
      <Text style={styles.help}>La respuesta del cambio no llegó. Consulta la junta activa antes de hacer otra solicitud.</Text>
      <Button label="Comprobar junta activa" onPress={onCheck} disabled={busy} />
    </View>}
    {!required && !unconfirmed && <Button label="Volver al resumen" onPress={onBack} disabled={busy} secondary />}
    {required && <Button label="Cerrar sesión" onPress={onLogout} disabled={busy} secondary />}
  </>;
}

const createStyles = (theme: SrdTheme) => StyleSheet.create({
  eyebrow: {fontFamily: theme.typography.family, color: theme.colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 32, fontWeight: '800'},
  heading: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 17, fontWeight: '700'},
  help: {fontFamily: theme.typography.family, color: theme.colors.muted, lineHeight: 21},
  card: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, padding: 18, borderRadius: theme.radius.card, gap: 14, elevation: theme.mode === 'dark' ? 0 : 1},
  label: {fontFamily: theme.typography.family, color: theme.colors.ink, fontWeight: '700'},
  input: {borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46, fontFamily: theme.typography.family, color: theme.colors.ink, backgroundColor: theme.colors.surface},
  terms: {fontFamily: theme.typography.family, color: theme.colors.ink, lineHeight: 22},
  checkbox: {flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44},
  mark: {fontFamily: theme.typography.family, color: theme.colors.accent, fontSize: 24},
  button: {backgroundColor: theme.colors.accent, paddingVertical: 15, borderRadius: theme.radius.control, alignItems: 'center'},
  buttonText: {fontFamily: theme.typography.family, color: '#fff', fontWeight: '800', fontSize: 16},
  secondary: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border},
  secondaryText: {fontFamily: theme.typography.family, color: theme.colors.ink},
  disabled: {opacity: 0.55},
});
