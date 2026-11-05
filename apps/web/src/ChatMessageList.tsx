import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download, FileText, Image as ImageIcon, Pause, Phone, Pin, Play, Reply, Trash2, Volume2 } from 'lucide-react';
import { formatLocale, t } from './i18n';
import type { Message } from './chatTypes';

function clockLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function VoiceNotePlayer({ src, onRequest, loading, label }: { src?: string; onRequest?: () => void; loading?: boolean; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const requested = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    setPlaying(false); setCurrent(0); setDuration(0);
    if (src && requested.current) { requested.current = false; void audio.current?.play().catch(() => undefined); }
  }, [src]);

  function toggle() {
    if (!src) { requested.current = true; onRequest?.(); return; }
    if (!audio.current) return;
    if (audio.current.paused) void audio.current.play().catch(() => undefined);
    else audio.current.pause();
  }

  return <div className="chat-voice-player"><audio ref={audio} src={src} preload="metadata" aria-label={label}
    onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
    onTimeUpdate={event => setCurrent(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    <button type="button" className="chat-voice-toggle" disabled={loading} onClick={toggle} aria-label={t(playing ? 'Pausar nota de voz' : 'Reproducir nota de voz')}>{playing ? <Pause size={19} /> : <Play size={19} />}</button>
    <span className="chat-voice-times">{clockLabel(Math.floor(current))}/{clockLabel(Math.floor(duration))}</span>
    <div className="chat-voice-timeline"><span aria-hidden="true">{[4,9,14,6,18,11,5,20,12,7,16,10,4,13,19,6,12,8,17,5,15,10,6,12].map((height, index) => <i key={index} className={duration && index / 24 <= current / duration ? 'played' : ''} style={{height}} />)}</span><input type="range" min="0" max={duration || 1} step="0.1" value={Math.min(current, duration || 0)} disabled={!src || !duration} aria-label={t('Avanzar nota de voz')} onChange={event => { if (audio.current) { audio.current.currentTime = Number(event.target.value); setCurrent(audio.current.currentTime); } }} /></div>
    <label className="chat-voice-volume" title={t('Volumen de la nota de voz')}><Volume2 size={17} /><input type="range" min="0" max="1" step="0.05" defaultValue="1" aria-label={t('Volumen de la nota de voz')} onChange={event => { if (audio.current) audio.current.volume = Number(event.target.value); }} /></label>
  </div>;
}

type ChatMessageListProps = {
  messages: Message[];
  selfId: string;
  contactName: string;
  audioPlayback?: { messageId: string; url: string };
  downloading?: string;
  imagePreviews: Record<string, string>;
  expandedMessages: ReadonlySet<string>;
  onTogglePin: (message: Message) => void;
  onReply: (message: Message) => void;
  onRequestRemoval: (message: Message) => void;
  onDownload: (message: Message) => void;
  onPlayVoice: (message: Message) => void;
  onOpenImage: (message: Message) => void;
  onToggleExpanded: (message: Message) => void;
};

export function ChatMessageList({
  messages,
  selfId,
  contactName,
  audioPlayback,
  downloading,
  imagePreviews,
  expandedMessages,
  onTogglePin,
  onReply,
  onRequestRemoval,
  onDownload,
  onPlayVoice,
  onOpenImage,
  onToggleExpanded,
}: ChatMessageListProps) {
  return <ol className="chat-messages">{messages.map(message => {
    const mine = message.sender_id === selfId;
    const expanded = expandedMessages.has(message.id);
    return <li key={message.id} id={`chat-message-${message.id}`} data-message-id={!message.system_kind && !mine && !message.read_at ? message.id : undefined} className={message.system_kind ? 'chat-call-event-row' : mine ? 'mine' : ''}>
      {message.system_kind ? <div className="chat-call-event"><Phone size={17} /><span><strong>{t(message.system_kind === 'call_missed' ? 'Llamada perdida' : 'Llamada finalizada')}</strong>{message.call_duration_seconds ? <small>{clockLabel(message.call_duration_seconds)}</small> : null}</span><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(formatLocale(), {timeZone:'America/Bogota'})}</time></div> : <>
        <div className="chat-bubble">
          <details className="chat-message-menu"><summary aria-label={t('Opciones del mensaje')} title={t('Opciones del mensaje')}><ChevronDown size={17} /></summary><div><button type="button" onClick={() => onTogglePin(message)}><Pin size={15} fill={message.pinned ? 'currentColor' : 'none'} />{t(message.pinned ? 'Desfijar mensaje' : 'Fijar mensaje')}</button><button type="button" onClick={() => onReply(message)}><Reply size={15} />{t('Responder mensaje')}</button><button type="button" onClick={() => onRequestRemoval(message)}><Trash2 size={15} />{t(mine ? 'Borrar para todos' : 'Borrar para mí')}</button>{message.attachment && <button type="button" onClick={() => onDownload(message)}><Download size={15} />{t('Descargar')}</button>}</div></details>
          {message.reply_to_id && <div className="chat-reply-quote"><Reply size={14} /><span>{messages.find(item => item.id === message.reply_to_id)?.body || t('Mensaje anterior')}</span></div>}
          {message.body && <><p className={message.body.length > 480 && !expanded ? 'chat-text-collapsed' : ''}>{message.body}</p>{message.body.length > 480 && <button type="button" className="chat-expand-text" onClick={() => onToggleExpanded(message)}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{t(expanded ? 'Mostrar menos' : 'Mostrar más')}</button>}</>}
          {message.attachment?.mime.startsWith('image/') && <button type="button" className="chat-image-card" aria-label={t('Ampliar imagen {name}', {name: message.attachment.name})} onClick={() => onOpenImage(message)}>{imagePreviews[message.id] ? <img src={imagePreviews[message.id]} alt={message.attachment.name} /> : <span><ImageIcon size={20} />{message.attachment.name}</span>}</button>}
          {message.attachment?.mime.startsWith('audio/') && <VoiceNotePlayer key={message.id} src={audioPlayback?.messageId === message.id ? audioPlayback.url : undefined} onRequest={() => onPlayVoice(message)} loading={downloading === message.id} label={t('Nota de voz de {name}', {name: mine ? t('Tú') : contactName})} />}
          {message.attachment && !message.attachment.mime.startsWith('image/') && !message.attachment.mime.startsWith('audio/') && <button type="button" className="chat-file-card" disabled={!!downloading} onClick={() => onDownload(message)}><FileText size={20} /><span>{message.attachment.name}<small>{(message.attachment.bytes / 1024 / 1024).toFixed(1)} MB</small></span><Download size={17} /></button>}
          <div className="chat-bubble-meta"><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(formatLocale(), {timeZone:'America/Bogota'})}</time><span>{t(mine ? message.read_at ? 'Leído' : message.delivered_at ? 'Entregado' : 'Enviado' : 'Recibido')}</span></div>
        </div>
      </>}
    </li>;
  })}</ol>;
}
