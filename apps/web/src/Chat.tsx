import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, api, roleNames } from './api';
import { reportAuthorizationLoss } from './chatAuthorization';
import { Empty, ErrorBox, Loading } from './ui';
import { formatLocale, localizedLabel, t, useLanguage } from './i18n';
import { ContactAvatar } from './ContactAvatar';
import { mergeMessages, mergeReceipts, withReceipt } from './chatMessageMerge';
import { useChatVoiceRecorder } from './useChatVoiceRecorder';
import { useChatRealtime } from './useChatRealtime';
import { useChatDraft } from './useChatDraft';
import { ChatConversationList } from './ChatConversationList';
import { ChatMessageList } from './ChatMessageList';
import { ChatComposer } from './ChatComposer';
import { activityLabels, presenceLabels, type ChatAttachment, type Conversation, type Message } from './chatTypes';
import { ChevronDown, Download, Eye, Phone, Pin, Reply, Search, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Modal } from './ui';

type ConversationPage = { items: Conversation[]; page: number; page_size: number; total: number };
type History = { items: Message[]; next_before: number | null; next_after: number | null; removed_ids?: string[]; receipts: Pick<Message, 'id' | 'delivered_at' | 'read_at'>[] };
type Receipt = { items: Pick<Message, 'id' | 'delivered_at' | 'read_at'>[] };

export function Chat({ userId, conversationId, onStarted, onOpened, selfId, organizationId, onContacts, onVoiceSelection }: { userId?: string; conversationId?: string; onStarted: () => void; onOpened: () => void; selfId: string; organizationId: string; onContacts: () => void; onVoiceSelection: (value?: { id: string; name: string }) => void }) {
  useLanguage();
  useChatRealtime(selfId, organizationId);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationPage, setConversationPage] = useState(1);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [conversationPageSize, setConversationPageSize] = useState(25);
  const [selected, setSelected] = useState<Conversation>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const [audioPlayback, setAudioPlayback] = useState<{ messageId: string; url: string }>();
  const [downloading, setDownloading] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversationError, setConversationError] = useState(false);
  const [messageError, setMessageError] = useState<unknown>();
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [refresh, setRefresh] = useState(0);
  const [visibilityTick, setVisibilityTick] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>();
  const [searchBusy, setSearchBusy] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [imageViewer, setImageViewer] = useState<Message>();
  const [imageZoom, setImageZoom] = useState(1);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(() => new Set());
  const [contactOpen, setContactOpen] = useState(false);
  const [contactDetails, setContactDetails] = useState<{name?: string; presence?: string; email?: string; role?: string; title?: string | null; title_en?: string | null; bio?: string | null; bio_en?: string | null}>();
  const [contactPresences, setContactPresences] = useState<Record<string, string>>({});
  const [removeMessage, setRemoveMessage] = useState<Message>();
  const [clearOpen, setClearOpen] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const imageUrlsRef = useRef<Record<string, string>>({});
  const imageLoadingRef = useRef(new Set<string>());
  const deliveredIds = useRef(new Set<string>());
  const readingIds = useRef(new Set<string>());
  const messagesRef = useRef<Message[]>([]);
  const latestSequence = useRef(0);
  const selectedIdRef = useRef(selected?.id);
  selectedIdRef.current = selected?.id;
  const draft = useChatDraft({
    conversationId: selected?.id,
    isCurrentConversation: id => selectedIdRef.current === id,
    onSent: (_id, message) => setMessages(current => mergeMessages(current, [message])),
    onRefresh: () => setRefresh(current => current + 1),
  });
  const isBusy = busy || draft.sending;
  const { recording, recordPaused, recordSeconds, waveform, processingAudio, startRecording, stopRecording, toggleRecordPause } = useChatVoiceRecorder({
    conversationId: selected?.id, busy: isBusy, setError, setFile: draft.setFile, setPendingId: draft.setPendingId,
  });

  useEffect(() => {
    onVoiceSelection(undefined);
    return () => onVoiceSelection(undefined);
  }, []);

  function selectConversation(value: Conversation) {
    if (selectedIdRef.current === value.id) return;
    if (selectedIdRef.current) void api(`conversations/${selectedIdRef.current}/activity`, 'POST', {kind: 'idle'}).catch(() => undefined);
    selectedIdRef.current = value.id;
    setSelected(value);
    onVoiceSelection({ id: value.id, name: value.contact.name });
    draft.resetForConversation(); setError(undefined);
    setSearchOpen(false); setSearchResults(undefined); setSearchTerm(''); setPinnedMessages([]);
    setImageViewer(undefined); setContactOpen(false); setExpandedMessages(new Set());
  }

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const outgoingActivity = recording ? 'recording' : draft.body.trim() ? 'typing' : 'idle';
  useEffect(() => {
    const id = selected?.id;
    if (!id) return;
    const sendActivity = () => { if (!document.hidden) void api(`conversations/${id}/activity`, 'POST', {kind: outgoingActivity}).catch(() => undefined); };
    sendActivity();
    if (outgoingActivity === 'idle') return;
    const interval = window.setInterval(sendActivity, 3000);
    return () => clearInterval(interval);
  }, [selected?.id, outgoingActivity]);
  const selectedActivity = conversations.find(item => item.id === selected?.id)?.contact_activity || selected?.contact_activity;
  useEffect(() => () => { if (audioPlayback) URL.revokeObjectURL(audioPlayback.url); }, [audioPlayback]);
  useEffect(() => {
    const conversation = selected?.id;
    if (!conversation) return;
    let active = true;
    setImagePreviews({});
    void api<{items: Message[]}>(`conversations/${conversation}/pinned`)
      .then(value => { if (active) setPinnedMessages(value.items); })
      .catch(value => { if (active) setError(value); });
    return () => {
      active = false;
      Object.values(imageUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
      imageUrlsRef.current = {};
      imageLoadingRef.current.clear();
      setImagePreviews({});
    };
  }, [selected?.id]);
  useEffect(() => {
    const contactId = selected?.contact.id;
    if (!contactId) { setContactDetails(undefined); return; }
    let active = true;
    const load = () => {
      void api<{name?: string; presence?: string; email?: string; role?: string; title?: string | null; title_en?: string | null; bio?: string | null; bio_en?: string | null}>(`contacts/${contactId}`)
        .then(value => { if (active) setContactDetails(value); })
        .catch(error => { if (active) reportAuthorizationLoss(error); });
    };
    load();
    const interval = window.setInterval(load, 30000);
    return () => { active = false; clearInterval(interval); };
  }, [selected?.contact.id, organizationId]);
  useEffect(() => {
    if (!conversations.length) return;
    let active = true;
    const load = async () => {
      const results = await Promise.allSettled(conversations.map(item => api<{presence?: string}>(`contacts/${item.contact.id}`)));
      if (!active) return;
      const next: Record<string, string> = {};
      results.forEach((result, index) => { if (result.status === 'fulfilled') next[conversations[index].contact.id] = result.value.presence || 'offline'; });
      setContactPresences(next);
    };
    void load();
    const interval = window.setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [conversations.map(item => item.contact.id).join(','), organizationId]);
  useEffect(() => {
    if (!selected) return;
    const conversation = selected.id;
    for (const message of messages) {
      if (!message.attachment?.mime.startsWith('image/') || imageUrlsRef.current[message.id] || imageLoadingRef.current.has(message.id)) continue;
      imageLoadingRef.current.add(message.id);
      void api<ChatAttachment & {content: string}>(`conversations/${conversation}/messages/${message.id}/attachment`)
        .then(result => {
          if (!result.mime.startsWith('image/')) return;
          const url = `data:${result.mime};base64,${result.content}`;
          if (selectedIdRef.current !== conversation) return;
          imageUrlsRef.current[message.id] = url;
          setImagePreviews(current => ({ ...current, [message.id]: url }));
        })
        .catch(() => undefined)
        .finally(() => imageLoadingRef.current.delete(message.id));
    }
  }, [selected?.id, messages]);
  useEffect(() => { setAudioPlayback(undefined); }, [selected?.id]);

  async function confirmDelivered(conversationId: string, fetched: Message[]) {
    const ids = fetched.filter(message => message.sender_id !== selfId && !message.delivered_at && !deliveredIds.current.has(message.id)).map(message => message.id);
    if (!ids.length) return;
    ids.forEach(id => deliveredIds.current.add(id));
    try {
      const value = await api<Receipt>(`conversations/${conversationId}/receipts`, 'POST', { kind: 'delivered', message_ids: ids });
      setMessages(current => current.map(message => {
        const receipt = value.items.find(item => item.id === message.id);
        return withReceipt(message, receipt);
      }));
    } catch {
      ids.forEach(id => deliveredIds.current.delete(id));
    }
  }

  useEffect(() => {
    let active = true;
    let running = false;
    let stopped = false;
    const load = async () => {
      if (document.hidden || running || stopped) return;
      running = true;
      try {
        const value = await api<ConversationPage>(`conversations?page=${conversationPage}`);
        if (active) {
          const lastPage = Math.max(1, Math.ceil(value.total / value.page_size));
          if (conversationPage > lastPage) { setConversationPage(lastPage); return; }
          setConversations(value.items); setConversationTotal(value.total); setConversationError(false);
          setConversationPageSize(value.page_size); setLoading(false); setError(undefined);
        }
      } catch (value) {
        if (active) { setError(value); setConversations([]); setConversationTotal(0); setConversationError(true); setLoading(false); }
        if (active && value instanceof ApiError && [401, 403].includes(value.status)) { stopped = true; reportAuthorizationLoss(value); }
      } finally { running = false; }
    };
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    document.addEventListener('visibilitychange', load);
    document.addEventListener('srd-chat-change', load);
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange', load); document.removeEventListener('srd-chat-change', load); };
  }, [conversationPage, refresh]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setBusy(true);
    void api<Conversation>('conversations', 'POST', { user_id: userId }).then(value => {
      if (active) { selectConversation(value); setConversationPage(1); setConversations(current => [value, ...current.filter(item => item.id !== value.id)]); setRefresh(current => current + 1); onStarted(); }
    }).catch(value => { if (active) setError(value); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [userId, onStarted]);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    void api<Conversation>(`conversations/${conversationId}`).then(value => {
      if (active) { selectConversation(value); setConversationPage(1); setConversations(current => [value, ...current.filter(item => item.id !== value.id)]); setRefresh(current => current + 1); onOpened(); }
    }).catch(value => { if (active) setError(value); });
    return () => { active = false; };
  }, [conversationId, onOpened]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    let running = false;
    let initialized = false;
    let stopped = false;
    deliveredIds.current.clear(); readingIds.current.clear();
    messagesRef.current = []; latestSequence.current = 0;
    setMessages([]); setBefore(null);
    setMessageError(undefined); setMessageLoading(true);
    const load = async () => {
      if (document.hidden || running || stopped) return;
      running = true;
      try {
        if (!initialized) {
          const value = await api<History>(`conversations/${selected.id}/messages`);
          if (!active) return;
          setMessages(current => mergeMessages(current, value.items));
          setBefore(value.next_before);
          latestSequence.current = Math.max(latestSequence.current, value.items.at(-1)?.sequence ?? 0);
          initialized = true;
          setMessageLoading(false);
          void confirmDelivered(selected.id, value.items);
        } else {
          const receiptIds = messagesRef.current.filter(message => message.sender_id === selfId).slice(-25).map(message => message.id);
          for (let page = 0; page < 4; page++) {
            const query = new URLSearchParams({ after: String(latestSequence.current) });
            receiptIds.forEach((id, index) => query.append(`receipt_ids[${index}]`, id));
            if (page === 0) messagesRef.current.slice(-100).forEach((message, index) => query.append(`visible_ids[${index}]`, message.id));
            const value = await api<History>(`conversations/${selected.id}/messages?${query}`);
            if (!active) return;
            setMessages(current => mergeReceipts(mergeMessages(current.filter(item => !value.removed_ids?.includes(item.id)), value.items), value.receipts));
            if (value.removed_ids?.length) setPinnedMessages(current => current.filter(item => !value.removed_ids?.includes(item.id)));
            latestSequence.current = Math.max(latestSequence.current, value.items.at(-1)?.sequence ?? 0);
            void confirmDelivered(selected.id, value.items);
            if (value.next_after === null) break;
          }
        }
        setMessageError(undefined);
      } catch (value) {
        if (active) { setMessageError(value); setMessageLoading(false); }
        if (active && value instanceof ApiError && [401, 403].includes(value.status)) { stopped = true; reportAuthorizationLoss(value); }
      }
      finally { running = false; }
    };
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    document.addEventListener('visibilitychange', load);
    document.addEventListener('srd-chat-change', load);
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange', load); document.removeEventListener('srd-chat-change', load); };
  }, [selected?.id]);

  useEffect(() => {
    const onVisibility = () => setVisibilityTick(value => value + 1);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!selected || document.hidden) return;
    const conversationId = selected.id;
    const observer = new IntersectionObserver(entries => {
      if (document.hidden) return;
      const ids = entries.filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)
        .map(entry => (entry.target as HTMLElement).dataset.messageId).filter((id): id is string => !!id && !readingIds.current.has(id));
      if (!ids.length) return;
      for (let index = 0; index < ids.length; index += 25) {
        const batch = ids.slice(index, index + 25);
        batch.forEach(id => readingIds.current.add(id));
        void api<Receipt>(`conversations/${conversationId}/receipts`, 'POST', { kind: 'read', message_ids: batch })
          .then(value => setMessages(current => mergeReceipts(current, value.items)))
          .catch(() => batch.forEach(id => readingIds.current.delete(id)));
      }
    }, { threshold: 0.5 });
    document.querySelectorAll<HTMLLIElement>('.chat-messages li[data-message-id]').forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [selected?.id, messages, visibilityTick]);

  async function older() {
    if (!selected || !before) return;
    try {
      const value = await api<History>(`conversations/${selected.id}/messages?before=${before}`);
      setMessages(current => mergeMessages(current, value.items)); setBefore(value.next_before); setError(undefined);
      void confirmDelivered(selected.id, value.items);
    } catch (value) { setError(value); }
  }

  async function jumpToMessage(message: Message) {
    if (!selected) return;
    if (!messages.some(item => item.id === message.id)) {
      try {
        const value = await api<History>(`conversations/${selected.id}/messages?before=${message.sequence + 1}`);
        setMessages(current => mergeMessages(current, value.items));
      } catch (value) { setError(value); return; }
    }
    window.setTimeout(() => {
      const target = document.getElementById(`chat-message-${message.id}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.classList.add('chat-jump-highlight');
      window.setTimeout(() => target?.classList.remove('chat-jump-highlight'), 1800);
    }, 50);
  }

  async function playVoice(message: Message) {
    if (!selected || !message.attachment || downloading) return;
    if (audioPlayback?.messageId === message.id) return;
    const conversation = selected.id;
    setDownloading(message.id); setError(undefined);
    try {
      const result = await api<ChatAttachment & {content:string}>(`conversations/${conversation}/messages/${message.id}/attachment`);
      if (!result.mime.startsWith('audio/')) throw new Error(t('El adjunto no es audio.'));
      const bytes = Uint8Array.from(atob(result.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
      if (selectedIdRef.current === conversation) setAudioPlayback({ messageId: message.id, url });
      else URL.revokeObjectURL(url);
    } catch (value) { setError(value); } finally { setDownloading(undefined); }
  }

  async function download(message: Message) {
    if (!selected || !message.attachment || downloading) return;
    setDownloading(message.id); setError(undefined);
    try {
      const result = await api<ChatAttachment & {content:string}>(`conversations/${selected.id}/messages/${message.id}/attachment`);
      const bytes = Uint8Array.from(atob(result.content), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
      const link = document.createElement('a'); link.href = url; link.download = result.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (value) { setError(value); } finally { setDownloading(undefined); }
  }

  async function searchMessages(event: FormEvent) {
    event.preventDefault();
    if (!selected || searchTerm.trim().length < 2) return;
    const conversation = selected.id;
    setSearchBusy(true); setError(undefined);
    try {
      const result = await api<{items: Message[]}>(`conversations/${conversation}/search?q=${encodeURIComponent(searchTerm.trim())}`);
      if (selectedIdRef.current === conversation) setSearchResults(result.items);
    } catch (value) { setError(value); }
    finally { setSearchBusy(false); }
  }

  async function togglePin(message: Message) {
    if (!selected) return;
    const conversation = selected.id;
    try {
      const result = await api<{pinned: boolean}>(`conversations/${conversation}/messages/${message.id}/pin`, 'POST');
      if (selectedIdRef.current !== conversation) return;
      const updated = { ...message, pinned: result.pinned };
      setMessages(current => current.map(item => item.id === message.id ? updated : item));
      setPinnedMessages(current => result.pinned ? [updated, ...current.filter(item => item.id !== message.id)] : current.filter(item => item.id !== message.id));
      setSearchResults(current => current?.map(item => item.id === message.id ? updated : item));
    } catch (value) { setError(value); }
  }

  async function hideMessage() {
    if (!selected || !removeMessage) return;
    const conversation = selected.id;
    const id = removeMessage.id;
    try {
      await api(`conversations/${conversation}/messages/${id}`, 'DELETE');
      if (selectedIdRef.current !== conversation) return;
      setMessages(current => current.filter(item => item.id !== id));
      setPinnedMessages(current => current.filter(item => item.id !== id));
      setSearchResults(current => current?.filter(item => item.id !== id));
      if (draft.replyTo?.id === id) draft.clearReply();
      setRemoveMessage(undefined);
    } catch (value) { setError(value); }
  }

  async function clearConversation() {
    if (!selected) return;
    const conversation = selected.id;
    try {
      await api(`conversations/${conversation}/messages`, 'DELETE');
      if (selectedIdRef.current !== conversation) return;
      setMessages([]); setBefore(null); setPinnedMessages([]); setSearchResults(undefined);
      draft.clearReply(); setClearOpen(false);
      latestSequence.current = 0;
    } catch (value) { setError(value); }
  }

  return <>
    <div className="page-heading"><div><h1>{t('Chat de la junta')}</h1><p className="muted">{t('Conversaciones privadas entre cuentas de la junta activa.')}</p></div><button type="button" onClick={onContacts}>{t('Buscar contacto')}</button></div>
    <ErrorBox error={error} />
    <div className={`chat-layout${selected ? ' has-conversation' : ''}`}>
      <ChatConversationList
        conversations={conversations}
        selectedId={selected?.id}
        loading={loading}
        error={conversationError}
        page={conversationPage}
        total={conversationTotal}
        pageSize={conversationPageSize}
        contactPresences={contactPresences}
        organizationId={organizationId}
        onSelect={selectConversation}
        onRetry={() => { setLoading(true); setRefresh(value => value + 1); }}
        onPreviousPage={() => { setLoading(true); setConversationPage(page => page - 1); }}
        onNextPage={() => { setLoading(true); setConversationPage(page => page + 1); }}
      />
      <section className="panel chat-thread" aria-label={t('Mensajes')}>{selected ? <>
        <header className="chat-contact-heading">
          <button type="button" className="chat-contact-profile" onClick={() => setContactOpen(true)} aria-label={t('Ver perfil de {name}', {name: selected.contact.name})}><ContactAvatar organizationId={organizationId} userId={selected.contact.id} name={selected.contact.name} /><span className="chat-contact-name"><strong>{selected.contact.name}</strong>{selectedActivity ? <span className="chat-activity">{t(activityLabels[selectedActivity])}</span> : <span className="presence-status" data-state={contactDetails?.presence || 'offline'}><span aria-hidden="true">●</span> {t(presenceLabels[contactDetails?.presence || 'offline'])}</span>}</span></button>
          <div className="chat-header-actions">
            <button type="button" className="chat-icon-button" aria-label={t('Llamar a {name}', {name: selected.contact.name})} title={t('Llamar a {name}', {name: selected.contact.name})} onClick={() => window.dispatchEvent(new Event('srd-voice-call-start'))}><Phone size={19} /></button>
            <button type="button" className="chat-icon-button" aria-label={t('Buscar mensajes')} title={t('Buscar mensajes')} onClick={() => setSearchOpen(value => !value)}><Search size={19} /></button>
            <button type="button" className="chat-icon-button" aria-label={t('Vaciar chat para mí')} title={t('Vaciar chat para mí')} onClick={() => setClearOpen(true)}><Trash2 size={19} /></button>
          </div>
        </header>
        {messageLoading && <Loading />}
        {messageError && <div className="chat-thread-error"><ErrorBox error={messageError} /><button type="button" onClick={() => document.dispatchEvent(new Event('srd-chat-change'))}>{t('Reintentar mensajes')}</button></div>}
        {searchOpen && <form className="chat-search" onSubmit={searchMessages}><label className="chat-sr-only" htmlFor="chat-search-input">{t('Buscar mensajes')}</label><input id="chat-search-input" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setSearchResults(undefined); }} placeholder={t('Busca palabras o archivos')} minLength={2} maxLength={120} autoFocus /><button type="submit" disabled={searchBusy || searchTerm.trim().length < 2}><Search size={17} />{t('Buscar')}</button><button type="button" className="chat-icon-button" aria-label={t('Cerrar búsqueda')} onClick={() => { setSearchOpen(false); setSearchResults(undefined); }}><X size={18} /></button></form>}
        {searchResults && <div className="chat-search-results" role="status"><strong>{t('Resultados: {count}', {count: searchResults.length})}</strong>{searchResults.map(item => <div key={item.id}><span>{item.body || item.attachment?.name}</span><small>{new Date(item.created_at).toLocaleString(formatLocale(), {timeZone:'America/Bogota'})}</small></div>)}</div>}
        {pinnedMessages.length > 0 && <details className="chat-pinned"><summary><Pin size={15} /><strong>{t('Fijados')}</strong><span>{t('{count} mensajes', {count: pinnedMessages.length})}</span><ChevronDown size={17} /></summary><ul>{pinnedMessages.map(item => <li key={item.id}><span>{item.body || item.attachment?.name}</span><button type="button" className="chat-icon-button" title={t('Ir al mensaje')} aria-label={t('Ir al mensaje')} onClick={() => void jumpToMessage(item)}><Eye size={17} /></button></li>)}</ul></details>}
        {before && <button className="chat-older" type="button" onClick={() => void older()}>{t('Ver mensajes anteriores')}</button>}
        <ChatMessageList
          messages={messages}
          selfId={selfId}
          contactName={selected.contact.name}
          audioPlayback={audioPlayback}
          downloading={downloading}
          imagePreviews={imagePreviews}
          expandedMessages={expandedMessages}
          onTogglePin={message => { void togglePin(message); }}
          onReply={message => { draft.startReply(message); draft.bodyInputRef.current?.focus(); }}
          onRequestRemoval={setRemoveMessage}
          onDownload={message => { void download(message); }}
          onPlayVoice={message => { void playVoice(message); }}
          onOpenImage={message => { setImageViewer(message); setImageZoom(1); }}
          onToggleExpanded={message => setExpandedMessages(current => {
            const next = new Set(current);
            if (next.has(message.id)) next.delete(message.id);
            else next.add(message.id);
            return next;
          })}
        />
        <ChatComposer
          body={draft.body}
          file={draft.file}
          filePreview={draft.filePreview}
          filePreviewError={draft.filePreviewError}
          sendError={draft.sendError}
          replyTo={draft.replyTo}
          busy={isBusy}
          recording={recording}
          recordPaused={recordPaused}
          recordSeconds={recordSeconds}
          waveform={waveform}
          processingAudio={processingAudio}
          fileInputRef={draft.fileInputRef}
          bodyInputRef={draft.bodyInputRef}
          onSubmit={event => { void draft.send(event, busy || recording || processingAudio); }}
          onBodyChange={(value, input) => {
            draft.changeBody(value);
            input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
          }}
          onFileChange={draft.selectFile}
          onCancelFile={draft.cancelFile}
          onCancelReply={draft.cancelReply}
          onFilePreviewError={() => draft.setFilePreviewError(true)}
          onAttach={() => draft.fileInputRef.current?.click()}
          onStartRecording={() => { void startRecording(); }}
          onToggleRecordPause={toggleRecordPause}
          onStopRecording={stopRecording}
        />
      </> : <Empty title={t('Selecciona una conversación')}>{t('Elige una conversación o busca un contacto.')}</Empty>}</section>
    </div>
    {imageViewer && <Modal title={t('Vista ampliada de imagen')} onClose={() => setImageViewer(undefined)}><div className="chat-image-viewer"><div className="chat-image-toolbar"><button type="button" title={t(imageViewer.pinned ? 'Desfijar mensaje' : 'Fijar mensaje')} aria-label={t(imageViewer.pinned ? 'Desfijar mensaje' : 'Fijar mensaje')} onClick={() => void togglePin(imageViewer)}><Pin size={18} /></button><button type="button" title={t('Responder mensaje')} aria-label={t('Responder mensaje')} onClick={() => { draft.startReply(imageViewer); setImageViewer(undefined); draft.bodyInputRef.current?.focus(); }}><Reply size={18} /></button><button type="button" title={t('Borrar mensaje')} aria-label={t('Borrar mensaje')} onClick={() => { setRemoveMessage(imageViewer); setImageViewer(undefined); }}><Trash2 size={18} /></button><button type="button" title={t('Descargar')} aria-label={t('Descargar')} onClick={() => void download(imageViewer)}><Download size={18} /></button><span aria-hidden="true" /><button type="button" title={t('Reducir')} aria-label={t('Reducir')} onClick={() => setImageZoom(value => Math.max(1, value - .5))}><ZoomOut size={18} /></button><strong>{Math.round(imageZoom * 100)}%</strong><button type="button" title={t('Ampliar')} aria-label={t('Ampliar')} onClick={() => setImageZoom(value => Math.min(4, value + .5))}><ZoomIn size={18} /></button></div>{imagePreviews[imageViewer.id] ? <div className="chat-image-viewport"><button type="button" className={`chat-image-zoom-target${imageZoom > 1 ? ' zoomed' : ''}`} aria-label={t(imageZoom > 1 ? 'Reducir imagen' : 'Ampliar imagen')} onClick={() => setImageZoom(value => value > 1 ? 1 : 2)}><img src={imagePreviews[imageViewer.id]} alt={imageViewer.attachment?.name || t('Imagen')} style={{ transform: `scale(${imageZoom})` }} /></button></div> : <p>{t('Cargando imagen…')}</p>}</div></Modal>}
    {contactOpen && selected && <Modal title={t('Perfil del contacto')} onClose={() => setContactOpen(false)}><div className="chat-contact-panel"><div className="chat-contact-card"><ContactAvatar organizationId={organizationId} userId={selected.contact.id} name={selected.contact.name} /><div className="chat-contact-identity"><h3>{contactDetails?.name || selected.contact.name}</h3><span className="presence-status" data-state={contactDetails?.presence || 'offline'}><span aria-hidden="true">●</span> {t(presenceLabels[contactDetails?.presence || 'offline'])}</span></div></div><div className="chat-contact-info"><div><span>{t('Correo electrónico')}</span><strong>{contactDetails?.email ? <a href={`mailto:${contactDetails.email}`}>{contactDetails.email}</a> : t('Sin registrar')}</strong></div><div><span>{t('Cargo')}</span><strong>{contactDetails?.title ? localizedLabel({label: contactDetails.title, label_en: contactDetails.title_en}) : t('Sin registrar')}</strong></div><div><span>{t('Rol de acceso')}</span><strong>{contactDetails?.role ? t(roleNames[contactDetails.role] || contactDetails.role) : t('Sin registrar')}</strong></div></div><div className="chat-contact-about"><span>{t('Acerca de')}</span><p>{contactDetails?.bio ? localizedLabel({label: contactDetails.bio, label_en: contactDetails.bio_en}) : t('Sin descripción todavía.')}</p></div></div></Modal>}
    {removeMessage && <Modal title={t(removeMessage.sender_id === selfId ? 'Borrar para todos' : 'Borrar para mí')} onClose={() => setRemoveMessage(undefined)}><p>{t(removeMessage.sender_id === selfId ? 'Este mensaje dejará de aparecer para ambos participantes.' : 'Este mensaje dejará de aparecer solo en tu cuenta.')}</p><div className="actions end"><button type="button" onClick={() => setRemoveMessage(undefined)}>{t('Cancelar')}</button><button type="button" className="danger-button" onClick={() => void hideMessage()}>{t(removeMessage.sender_id === selfId ? 'Borrar para todos' : 'Borrar para mí')}</button></div></Modal>}
    {clearOpen && <Modal title={t('Vaciar chat para mí')} onClose={() => setClearOpen(false)}><p>{t('Los mensajes actuales dejarán de aparecer solo en tu cuenta. Los mensajes nuevos seguirán llegando.')}</p><div className="actions end"><button type="button" onClick={() => setClearOpen(false)}>{t('Cancelar')}</button><button type="button" className="danger-button" onClick={() => void clearConversation()}>{t('Vaciar chat')}</button></div></Modal>}
  </>;
}
