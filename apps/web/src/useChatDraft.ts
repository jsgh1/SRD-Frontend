import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { api } from './api';
import { t } from './i18n';
import type { Message } from './chatTypes';

type UseChatDraftOptions = {
  conversationId?: string;
  isCurrentConversation: (conversationId: string) => boolean;
  onSent: (conversationId: string, message: Message) => void;
  onRefresh: () => void;
};

const ATTACHMENT_EXTENSIONS = /\.(png|jpe?g|webp|pdf|docx|xlsx|wav|mp3)$/i;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

export function useChatDraft({ conversationId, isCurrentConversation, onSent, onRefresh }: UseChatDraftOptions) {
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File>();
  const [filePreview, setFilePreview] = useState<string>();
  const [filePreviewError, setFilePreviewError] = useState(false);
  const [pendingId, setPendingId] = useState<string>();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<unknown>();
  const [replyTo, setReplyTo] = useState<Message>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!body && bodyInputRef.current) bodyInputRef.current.style.height = 'auto';
  }, [body]);

  useEffect(() => {
    setFilePreview(undefined);
    setFilePreviewError(false);
    const image = !!file && (file.type.startsWith('image/') || IMAGE_EXTENSIONS.test(file.name));
    const audio = !!file && (file.type.startsWith('audio/') || /\.(wav|mp3)$/i.test(file.name));
    if (!file || (!image && !audio)) { setFilePreview(undefined); return; }
    if (image) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(String(reader.result));
      reader.onerror = () => setFilePreview(undefined);
      reader.readAsDataURL(file);
      return () => { reader.onload = null; reader.onerror = null; if (reader.readyState === FileReader.LOADING) reader.abort(); };
    }
    const preview = file.type ? file : new Blob([file], { type: /\.mp3$/i.test(file.name) ? 'audio/mpeg' : 'audio/wav' });
    const url = URL.createObjectURL(preview);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function resetForConversation() {
    generationRef.current++;
    setBody(''); setFile(undefined); setPendingId(undefined); setSendError(undefined); setReplyTo(undefined);
    setFilePreview(undefined); setFilePreviewError(false);
  }

  function changeBody(value: string) {
    if (value !== body) {
      generationRef.current++;
      setPendingId(undefined);
      setSendError(undefined);
    }
    setBody(value);
  }

  function selectFile(value?: File) {
    generationRef.current++;
    setFilePreview(undefined); setFilePreviewError(false);
    setFile(value); setPendingId(undefined); setSendError(undefined);
  }

  function cancelFile() {
    setFile(undefined); setPendingId(undefined); setSendError(undefined);
  }

  function startReply(message: Message) {
    generationRef.current++;
    setPendingId(undefined);
    setReplyTo(message);
  }

  function cancelReply() {
    generationRef.current++;
    setPendingId(undefined);
    setReplyTo(undefined);
  }

  async function send(event: FormEvent, blocked = false) {
    event.preventDefault();
    if (!conversationId || (!body.trim() && !file) || blocked || sending) return;
    const conversation = conversationId;
    const generation = generationRef.current;
    const clientId = pendingId ?? crypto.randomUUID();
    setPendingId(clientId); setSending(true); setSendError(undefined);
    try {
      let attachment: { name: string; content: string } | undefined;
      if (file) {
        const isImage = IMAGE_EXTENSIONS.test(file.name);
        if (file.size === 0 || file.size > (isImage ? 5 : 10) * 1024 * 1024 || !ATTACHMENT_EXTENSIONS.test(file.name))
          throw new Error(t('Adjunta una imagen de hasta 5 MB o un PDF, DOCX, XLSX, WAV o MP3 de hasta 10 MB.'));
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 32768)
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
        attachment = { name: file.name, content: btoa(binary) };
      }
      const message = await api<Message>(`conversations/${conversation}/messages`, 'POST', {
        client_id: clientId, body, reply_to_id: replyTo?.id ?? null, ...(attachment ? { attachment } : {}),
      });
      if (isCurrentConversation(conversation)) {
        onSent(conversation, message);
        if (generationRef.current === generation) {
          setBody(''); setFile(undefined); setPendingId(undefined); setReplyTo(undefined);
        }
        setSendError(undefined);
      }
      onRefresh();
    } catch (value) {
      if (isCurrentConversation(conversation)) setSendError(value);
    } finally {
      setSending(false);
    }
  }

  return {
    body, file, filePreview, filePreviewError, sending, sendError, replyTo,
    fileInputRef, bodyInputRef,
    setFile: setFile as Dispatch<SetStateAction<File | undefined>>,
    setPendingId: setPendingId as Dispatch<SetStateAction<string | undefined>>,
    setFilePreviewError,
    resetForConversation, changeBody, selectFile, cancelFile, startReply, cancelReply,
    clearReply: () => setReplyTo(undefined), send,
  };
}
