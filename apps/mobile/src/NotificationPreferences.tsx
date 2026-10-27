import React from 'react';
import {useSrdStyles, useSrdTheme, type SrdTheme} from './theme';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {type NotificationPreferences} from './api';

function Choice({label, detail, checked, busy, onPress}: {
  label: string; detail?: string; checked: boolean; busy: boolean; onPress: () => void;
}) {
  const styles = useSrdStyles(createStyles);
  return <Pressable accessibilityRole="checkbox" accessibilityState={{checked, disabled: busy}}
    onPress={onPress} disabled={busy} style={styles.choice}>
    <Text style={styles.mark}>{checked ? '☑' : '□'}</Text>
    <View style={styles.choiceText}><Text style={styles.label}>{label}</Text>{!!detail && <Text style={styles.help}>{detail}</Text>}</View>
  </Pressable>;
}

export function NotificationPreferencesScreen({draft, busy, unconfirmed, onChange, onSave, onBack}: {
  draft: NotificationPreferences; busy: boolean; unconfirmed: boolean;
  onChange: (value: NotificationPreferences) => void; onSave: () => void; onBack: () => void;
}) {
  const theme = useSrdTheme();
  const styles = useSrdStyles(createStyles);
  const quietEnabled = draft.quiet_start !== null;
  return <>
    <Text style={styles.eyebrow}>CUENTA PERSONAL</Text>
    <Text style={styles.title}>Preferencias de avisos</Text>
    <Text style={styles.lead}>Elige qué avisos opcionales recibes en tu junta.</Text>
    <View style={styles.card}>
      <Choice label="Cambios de eventos" checked={draft.event_changes} busy={busy}
        onPress={() => onChange({...draft, event_changes: !draft.event_changes})} />
      <Choice label="Recordatorios de eventos" detail="24 horas y 1 hora antes, según el evento."
        checked={draft.reminders} busy={busy} onPress={() => onChange({...draft, reminders: !draft.reminders})} />
      <Choice label="Mensajes de Chat" checked={draft.chat_messages} busy={busy}
        onPress={() => onChange({...draft, chat_messages: !draft.chat_messages})} />
      <Text style={styles.help}>Las invitaciones y cancelaciones siempre llegan a la bandeja.</Text>
    </View>
    <View style={styles.card}>
      <Choice label="Horario de silencio" checked={quietEnabled} busy={busy}
        onPress={() => onChange({...draft, quiet_start: quietEnabled ? null : '22:00', quiet_end: quietEnabled ? null : '07:00'})} />
      {quietEnabled && <View style={styles.hours}>
        <View style={styles.hourField}><Text style={styles.label}>Desde (HH:mm)</Text>
          <TextInput accessibilityLabel="Silencio desde" value={draft.quiet_start ?? ''} onChangeText={value => onChange({...draft, quiet_start: value})}
            maxLength={5} placeholder="22:00" autoCorrect={false} style={styles.input} placeholderTextColor={theme.colors.placeholder} editable={!busy} /></View>
        <View style={styles.hourField}><Text style={styles.label}>Hasta (HH:mm)</Text>
          <TextInput accessibilityLabel="Silencio hasta" value={draft.quiet_end ?? ''} onChangeText={value => onChange({...draft, quiet_end: value})}
            maxLength={5} placeholder="07:00" autoCorrect={false} style={styles.input} placeholderTextColor={theme.colors.placeholder} editable={!busy} /></View>
      </View>}
      <Text style={styles.help}>El horario usa la hora de Colombia y puede cruzar medianoche. Oculta el distintivo de la campana web, pero conserva los avisos. No cambia tu presencia ni los correos de seguridad. Android aún no entrega avisos push.</Text>
    </View>
    {unconfirmed && <Text style={styles.help}>Vuelve a abrir las preferencias para consultar el estado antes de guardar otra vez.</Text>}
    <Pressable accessibilityRole="button" onPress={onSave} disabled={busy || unconfirmed} style={[styles.button, (busy || unconfirmed) && styles.disabled]}>
      <Text style={styles.buttonText}>Guardar preferencias</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onBack} disabled={busy} style={[styles.button, styles.secondary, busy && styles.disabled]}>
      <Text style={[styles.buttonText, styles.secondaryText]}>Volver a notificaciones</Text>
    </Pressable>
  </>;
}

const createStyles = (theme: SrdTheme) => StyleSheet.create({
  eyebrow: {fontFamily: theme.typography.family, color: theme.colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 32, fontWeight: '800'},
  lead: {fontFamily: theme.typography.family, color: theme.colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 10},
  card: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, padding: 18, borderRadius: theme.radius.card, gap: 14, elevation: theme.mode === 'dark' ? 0 : 1},
  choice: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 44},
  mark: {fontFamily: theme.typography.family, color: theme.colors.accent, fontSize: 24},
  choiceText: {flex: 1, gap: 2},
  label: {fontFamily: theme.typography.family, color: theme.colors.ink, fontWeight: '700'},
  help: {fontFamily: theme.typography.family, color: theme.colors.muted, lineHeight: 20},
  hours: {flexDirection: 'row', gap: 10},
  hourField: {flex: 1, gap: 6},
  input: {borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46, fontFamily: theme.typography.family, color: theme.colors.ink, backgroundColor: theme.colors.surface},
  button: {backgroundColor: theme.colors.accent, paddingVertical: 15, borderRadius: theme.radius.control, alignItems: 'center', marginTop: 5},
  buttonText: {fontFamily: theme.typography.family, color: '#fff', fontWeight: '800', fontSize: 16},
  secondary: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border},
  secondaryText: {fontFamily: theme.typography.family, color: theme.colors.ink},
  disabled: {opacity: 0.55},
});
