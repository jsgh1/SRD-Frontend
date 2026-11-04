export type ChatActivity = 'typing' | 'recording' | 'calling';

export type Conversation = {
  id: string;
  contact: { id: string; name: string };
  contact_activity?: ChatActivity | null;
  updated_at: string;
};

export const presenceLabels: Record<string, string> = {
  online: 'En línea',
  away: 'Ausente',
  dnd: 'No molestar',
  invisible: 'Desconectado',
  offline: 'Desconectado',
};

export const activityLabels: Record<ChatActivity, string> = {
  typing: 'Escribiendo…',
  recording: 'Grabando una nota de voz…',
  calling: 'Llamando…',
};
