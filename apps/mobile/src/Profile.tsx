import React from 'react';
import {useSrdStyles, type SrdTheme} from './theme';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {type Principal} from './api';

const presenceOptions: Array<{value: Principal['user']['presence']; label: string; help: string}> = [
  {value: 'online', label: 'En línea', help: 'Otros integrantes pueden ver tu disponibilidad.'},
  {value: 'away', label: 'Ausente', help: 'Indica que no estás disponible por ahora.'},
  {value: 'dnd', label: 'No molestar', help: 'Oculta el distintivo web de avisos; los avisos se conservan.'},
  {value: 'invisible', label: 'Invisible', help: 'Apareces desconectado para otros integrantes.'},
];

export function ProfileScreen({principal, name, presence, themeMode, busy, onName, onPresence, onTheme, onSave, onBack}: {
  principal: Principal; name: string; presence: Principal['user']['presence']; themeMode: Principal['user']['theme']; busy: boolean;
  onName: (name: string) => void; onPresence: (value: Principal['user']['presence']) => void;
  onTheme: (theme: Principal['user']['theme']) => void;
  onSave: () => void; onBack: () => void;
}) {
  const styles = useSrdStyles(createStyles);
  return <>
    <Text style={styles.eyebrow}>CUENTA PERSONAL</Text>
    <Text style={styles.title}>Mi perfil</Text>
    <Text style={styles.lead}>Actualiza tu nombre y cómo apareces ante tu junta.</Text>
    <View style={styles.card}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput accessibilityLabel="Nombre" value={name} onChangeText={onName} maxLength={120}
        autoCapitalize="words" style={styles.input} editable={!busy} />
      <Text style={styles.label}>Correo de acceso</Text>
      <Text style={styles.value}>{principal.user.email}</Text>
      <Text style={styles.help}>El cambio de correo se gestiona desde la web o Windows.</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.label}>Apariencia</Text>
      {([{value: 'light', label: 'Claro'}, {value: 'dark', label: 'Oscuro'}] as const).map(option => <Pressable key={option.value}
        accessibilityRole="radio" accessibilityState={{selected: themeMode === option.value, disabled: busy}}
        onPress={() => onTheme(option.value)} disabled={busy}
        style={[styles.choice, themeMode === option.value && styles.choiceSelected]}>
        <Text style={styles.choiceLabel}>{option.label}</Text>
      </Pressable>)}
      <Text style={styles.help}>La apariencia se comparte con tu cuenta de SRD en la web.</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.label}>Preferencia de presencia</Text>
      {presenceOptions.map(option => <Pressable key={option.value} accessibilityRole="radio"
        accessibilityState={{selected: presence === option.value, disabled: busy}}
        onPress={() => onPresence(option.value)} disabled={busy}
        style={[styles.choice, presence === option.value && styles.choiceSelected]}>
        <Text style={styles.choiceLabel}>{option.label}</Text>
        <Text style={styles.help}>{option.help}</Text>
      </Pressable>)}
      <Text style={styles.help}>La presencia efectiva también depende de la conexión activa.</Text>
    </View>
    <Pressable accessibilityRole="button" onPress={onSave} disabled={busy} style={[styles.button, busy && styles.disabled]}>
      <Text style={styles.buttonText}>Guardar perfil</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onBack} disabled={busy} style={[styles.button, styles.secondary, busy && styles.disabled]}>
      <Text style={[styles.buttonText, styles.secondaryText]}>Volver al resumen</Text>
    </Pressable>
  </>;
}

const createStyles = (theme: SrdTheme) => StyleSheet.create({
  eyebrow: {fontFamily: theme.typography.family, color: theme.colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 32, fontWeight: '800'},
  lead: {fontFamily: theme.typography.family, color: theme.colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 10},
  card: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, padding: 20, borderRadius: theme.radius.panel, gap: 12, elevation: theme.mode === 'dark' ? 0 : 1},
  label: {fontFamily: theme.typography.family, color: theme.colors.ink, fontWeight: '700'},
  input: {borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, paddingHorizontal: 14, paddingVertical: 11, minHeight: 46, fontFamily: theme.typography.family, color: theme.colors.ink, backgroundColor: theme.colors.surface},
  value: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 16},
  help: {fontFamily: theme.typography.family, color: theme.colors.muted, lineHeight: 20},
  choice: {borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, padding: 12, gap: 3, minHeight: 44, justifyContent: 'center'},
  choiceSelected: {borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft},
  choiceLabel: {fontFamily: theme.typography.family, color: theme.colors.ink, fontWeight: '700'},
  button: {backgroundColor: theme.colors.accent, paddingVertical: 15, borderRadius: theme.radius.control, alignItems: 'center', marginTop: 5},
  buttonText: {fontFamily: theme.typography.family, color: '#fff', fontWeight: '800', fontSize: 16},
  secondary: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border},
  secondaryText: {fontFamily: theme.typography.family, color: theme.colors.ink},
  disabled: {opacity: 0.55},
});
