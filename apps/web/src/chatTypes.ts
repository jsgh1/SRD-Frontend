export type ChatActivity = 'typing' | 'recording' | 'calling';

export type Conversation = {
  id: string;
  contact: { id: string; name: string };
  contact_activity?: ChatActivity | null;
  updated_at: string;
};

export type ChatAttachment = { id: string; name: string; mime: string; bytes: number };

export type Message = {
  id: string;
  sequence: number;
  sender_id: string;
  body: string;
  attachment: ChatAttachment | null;
  reply_to_id: string | null;
  pinned: boolean;
  system_kind?: 'call_missed' | 'call_ended' | null;
  call_duration_seconds?: number | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
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
