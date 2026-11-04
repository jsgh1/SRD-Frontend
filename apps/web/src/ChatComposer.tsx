import type { ChangeEvent, FormEventHandler, RefObject } from 'react';
import { Check, FileText, Image as ImageIcon, Mic, Pause, Paperclip, Play, Reply, Send, Trash2, X } from 'lucide-react';
import { t } from './i18n';
import { ErrorBox } from './ui';
import { VoiceNotePlayer } from './ChatMessageList';
import type { Message } from './chatTypes';

type ChatComposerProps = {
  body: string;
  file?: File;
  filePreview?: string;
  filePreviewError: boolean;
  sendError: unknown;
  replyTo?: Message;
  busy: boolean;
  recording: boolean;
  recordPaused: boolean;
  recordSeconds: number;
  waveform: number[];
  processingAudio: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  bodyInputRef: RefObject<HTMLTextAreaElement | null>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onBodyChange: (value: string, input: HTMLTextAreaElement) => void;
  onFileChange: (file?: File) => void;
  onCancelFile: () => void;
  onCancelReply: () => void;
  onFilePreviewError: () => void;
  onAttach: () => void;
  onStartRecording: () => void;
  onToggleRecordPause: () => void;
  onStopRecording: (discard?: boolean) => void;
};

function clockLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ChatComposer({
  body, file, filePreview, filePreviewError, sendError, replyTo, busy, recording, recordPaused,
  recordSeconds, waveform, processingAudio, fileInputRef, bodyInputRef, onSubmit, onBodyChange,
  onFileChange, onCancelFile, onCancelReply, onFilePreviewError, onAttach, onStartRecording,
  onToggleRecordPause, onStopRecording,
}: ChatComposerProps) {
  const isImage = !!file && /\.(png|jpe?g|webp)$/i.test(file.name);

  return (
    <form className="chat-composer" onSubmit={onSubmit}>
      {replyTo && <div className="chat-draft-reply"><Reply size={16} /><span>{t('Respondiendo a')} <strong>{replyTo.body || replyTo.attachment?.name}</strong></span><button type="button" aria-label={t('Cancelar respuesta')} onClick={onCancelReply}><X size={17} /></button></div>}
      {file && <div className="chat-attachment-preview"><div className="chat-preview-info">{file.type.startsWith('image/') ? <ImageIcon size={19} /> : <FileText size={19} />}<span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span><button type="button" aria-label={t('Cancelar adjunto')} disabled={busy || recording} onClick={onCancelFile}><X size={18} /></button></div>{filePreview && (isImage ? filePreviewError ? <p className="muted">{t('No se pudo mostrar la vista previa de la imagen.')}</p> : <img src={filePreview} alt={t('Vista previa del adjunto')} onError={onFilePreviewError} /> : <VoiceNotePlayer src={filePreview} label={t('Vista previa de la nota de voz')} />)}</div>}
      {recording && <div className="chat-record-actions" role="status"><span className={recordPaused ? 'chat-record-dot paused' : 'chat-record-dot'} aria-hidden="true" /><time>{clockLabel(recordSeconds)}</time><span className="chat-record-wave" aria-hidden="true">{waveform.map((height, index) => <i key={index} style={{height: `${3 + height * 25}px`}} />)}</span><span className="chat-sr-only">{t(recordPaused ? 'Grabación pausada' : 'Grabando nota de voz')}</span><button type="button" className="chat-icon-button" title={t(recordPaused ? 'Reanudar grabación' : 'Pausar grabación')} aria-label={t(recordPaused ? 'Reanudar grabación' : 'Pausar grabación')} onClick={onToggleRecordPause}>{recordPaused ? <Play size={19} /> : <Pause size={19} />}</button><button type="button" className="chat-icon-button" title={t('Terminar grabación')} aria-label={t('Terminar grabación')} onClick={() => onStopRecording()}><Check size={19} /></button><button type="button" className="chat-icon-button" title={t('Descartar grabación')} aria-label={t('Descartar grabación')} onClick={() => onStopRecording(true)}><Trash2 size={19} /></button></div>}
      {processingAudio && <p role="status">{t('Preparando nota de voz…')}</p>}
      <ErrorBox error={sendError} />
      <div className="chat-compose-row"><input ref={fileInputRef} className="chat-file-input" aria-hidden="true" tabIndex={-1} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.wav,.mp3" disabled={recording || processingAudio || busy} onChange={(event: ChangeEvent<HTMLInputElement>) => { onFileChange(event.target.files?.[0]); event.target.value = ''; }} /><button type="button" className="chat-icon-button" title={t('Adjuntar archivo')} aria-label={t('Adjuntar archivo')} disabled={recording || processingAudio || busy} onClick={onAttach}><Paperclip size={20} /></button><label className="chat-sr-only" htmlFor="chat-message-input">{t('Mensaje')}</label><textarea id="chat-message-input" ref={bodyInputRef} maxLength={10000} rows={1} placeholder={t('Mensaje')} value={body} onChange={event => onBodyChange(event.target.value, event.currentTarget)} /><button type="button" className="chat-icon-button" aria-label={t('Grabar nota de voz')} title={t('Grabar nota de voz')} disabled={busy || processingAudio || recording} onClick={onStartRecording}><Mic size={20} /></button><button className="primary chat-send" aria-label={t(busy ? 'Enviando…' : 'Enviar')} disabled={busy || recording || processingAudio || (!body.trim() && !file)}><Send size={18} /><span>{t(busy ? 'Enviando…' : 'Enviar')}</span></button></div>
    </form>
  );
}
