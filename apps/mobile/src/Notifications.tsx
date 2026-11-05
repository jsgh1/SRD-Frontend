import React, {useState} from 'react';
import {useSrdStyles, type SrdTheme} from './theme';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {bogotaDateTime} from './calendar';
import {type Notice, type NotificationInbox, type NotificationKind} from './notificationModels';

const kindNames: Record<NotificationKind, string> = {
  invitation: 'Invitación', event_changed: 'Cambio de evento', event_cancelled: 'Evento cancelado',
  reminder_24h: 'Recordatorio de 24 horas', reminder_1h: 'Recordatorio de 1 hora', chat_message: 'Chat',
};

function dateLabel(value: string): string {
  try {
    const {date, time} = bogotaDateTime(value);
    return `${date} · ${time}`;
  } catch {
    return 'Fecha no disponible';
  }
}

function Button({label, onPress, disabled = false}: {label: string; onPress: () => void; disabled?: boolean}) {
  const styles = useSrdStyles(createStyles);
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.button, disabled && styles.disabled]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

export function NotificationsScreen({inbox, busy, onRead, onDismiss, onOpenEvent, onPage, onRefresh, onPreferences, onBack}: {
  inbox: NotificationInbox; busy: boolean;
  onRead: (item: Notice) => void; onDismiss: (item: Notice) => void; onOpenEvent: (id: string) => void;
  onPage: (page: number) => void; onRefresh: () => void; onPreferences: () => void; onBack: () => void;
}) {
  const styles = useSrdStyles(createStyles);
  const [confirmDismiss, setConfirmDismiss] = useState<string | null>(null);
  return <>
    <Text style={styles.eyebrow}>BANDEJA PERSONAL</Text>
    <Text style={styles.title}>Notificaciones</Text>
    <Text style={styles.lead}>{inbox.unread} sin leer · {inbox.total} en total</Text>
    {inbox.items.length === 0 && <View style={styles.card}><Text style={styles.muted}>No tienes avisos en esta página.</Text></View>}
    {inbox.items.map(item => <View key={item.id} style={[styles.card, !item.read_at && styles.unread]}>
      <Text style={styles.kind}>{kindNames[item.kind] ?? item.kind}{!item.read_at ? ' · Sin leer' : ''}</Text>
      <Text style={styles.noticeTitle}>{item.title}</Text>
      <Text style={styles.muted}>{dateLabel(item.created_at)} · hora de Bogotá</Text>
      {item.event_id && <Pressable onPress={() => onOpenEvent(item.event_id!)} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Ver evento</Text></Pressable>}
      {item.kind === 'chat_message' && <Text style={styles.muted}>Abre Chat en web o Windows para ver la conversación.</Text>}
      {!item.read_at && <Pressable onPress={() => onRead(item)} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Marcar leído</Text></Pressable>}
      {confirmDismiss === item.id ? <View style={styles.confirm}>
        <Text style={styles.muted}>¿Descartar este aviso de la bandeja?</Text>
        <View style={styles.row}>
          <Pressable onPress={() => setConfirmDismiss(null)} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Cancelar</Text></Pressable>
          <Pressable onPress={() => {setConfirmDismiss(null); onDismiss(item);}} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Sí, descartar</Text></Pressable>
        </View>
      </View> : <Pressable onPress={() => setConfirmDismiss(item.id)} disabled={busy} accessibilityRole="button"><Text style={styles.link}>Descartar</Text></Pressable>}
    </View>)}
    {inbox.total > inbox.page_size && <View style={styles.row}>
      <Pressable onPress={() => {setConfirmDismiss(null); onPage(inbox.page - 1);}} disabled={busy || inbox.page <= 1} accessibilityRole="button"><Text style={[styles.link, (busy || inbox.page <= 1) && styles.disabled]}>Anterior</Text></Pressable>
      <Text style={styles.muted}>Página {inbox.page}</Text>
      <Pressable onPress={() => {setConfirmDismiss(null); onPage(inbox.page + 1);}} disabled={busy || inbox.page * inbox.page_size >= inbox.total} accessibilityRole="button"><Text style={[styles.link, (busy || inbox.page * inbox.page_size >= inbox.total) && styles.disabled]}>Siguiente</Text></Pressable>
    </View>}
    <Button label="Actualizar avisos" onPress={onRefresh} disabled={busy} />
    <Button label="Preferencias de avisos" onPress={onPreferences} disabled={busy} />
    <Button label="Volver al resumen" onPress={onBack} disabled={busy} />
  </>;
}

const createStyles = (theme: SrdTheme) => StyleSheet.create({
  eyebrow: {fontFamily: theme.typography.family, color: theme.colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 11},
  title: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 32, fontWeight: '800'},
  lead: {fontFamily: theme.typography.family, color: theme.colors.muted, fontSize: 16, marginBottom: 8},
  card: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, padding: 18, borderRadius: theme.radius.card, gap: 7, elevation: theme.mode === 'dark' ? 0 : 1},
  unread: {borderLeftWidth: 4, borderLeftColor: theme.colors.accent},
  kind: {fontFamily: theme.typography.family, color: theme.colors.accent, fontWeight: '700', fontSize: 12},
  noticeTitle: {fontFamily: theme.typography.family, color: theme.colors.ink, fontSize: 17, fontWeight: '700'},
  muted: {fontFamily: theme.typography.family, color: theme.colors.muted, lineHeight: 20},
  link: {fontFamily: theme.typography.family, color: theme.colors.accent, fontWeight: '700', paddingVertical: 5},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8},
  confirm: {backgroundColor: theme.colors.surfaceSoft, borderRadius: theme.radius.control, padding: 10, gap: 7},
  button: {backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.control, minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12},
  buttonText: {fontFamily: theme.typography.family, color: theme.colors.ink, fontWeight: '700'}, disabled: {opacity: 0.55},
});
