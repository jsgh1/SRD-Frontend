import { ContactAvatar } from './ContactAvatar';
import { activityLabels, presenceLabels, type Conversation } from './chatTypes';
import { t } from './i18n';
import { Empty, Loading } from './ui';

type ChatConversationListProps = {
  conversations: Conversation[];
  selectedId?: string;
  loading: boolean;
  error: boolean;
  page: number;
  total: number;
  pageSize: number;
  contactPresences: Record<string, string>;
  organizationId: string;
  onSelect: (conversation: Conversation) => void;
  onRetry: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function ChatConversationList({
  conversations,
  selectedId,
  loading,
  error,
  page,
  total,
  pageSize,
  contactPresences,
  organizationId,
  onSelect,
  onRetry,
  onPreviousPage,
  onNextPage,
}: ChatConversationListProps) {
  return (
    <section className="panel chat-sidebar" aria-label={t('Conversaciones')}>
      <h2>{t('Conversaciones')}</h2>
      {loading ? <Loading /> : error ? (
        <button type="button" onClick={onRetry}>{t('Reintentar conversaciones')}</button>
      ) : conversations.length ? (
        <ul className="chat-conversations">
          {conversations.map(item => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={selectedId === item.id ? 'true' : undefined}
                onClick={() => onSelect(item)}
              >
                <ContactAvatar organizationId={organizationId} userId={item.contact.id} name={item.contact.name} />
                <span className="chat-conversation-label">
                  <strong>{item.contact.name}</strong>
                  <small
                    className={item.contact_activity ? 'chat-activity' : 'presence-status'}
                    data-state={contactPresences[item.contact.id] || 'offline'}
                  >
                    {item.contact_activity
                      ? t(activityLabels[item.contact_activity])
                      : <><span aria-hidden="true">●</span> {t(presenceLabels[contactPresences[item.contact.id]] || 'Desconectado')}</>}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title={t('Sin conversaciones')}>{t('Busca un contacto para iniciar una conversación.')}</Empty>
      )}
      {total > pageSize && (
        <div className="actions">
          <button type="button" disabled={loading || page <= 1} onClick={onPreviousPage}>{t('Conversaciones anteriores')}</button>
          <span>{t('Página {page} de {pages}', { page, pages: Math.ceil(total / pageSize) })}</span>
          <button type="button" disabled={loading || page * pageSize >= total} onClick={onNextPage}>{t('Conversaciones siguientes')}</button>
        </div>
      )}
    </section>
  );
}
