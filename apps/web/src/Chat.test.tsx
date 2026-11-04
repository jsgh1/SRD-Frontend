import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api';
import { setLanguage } from './i18n';
import { Chat } from './Chat';

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, api: vi.fn() };
});

const apiMock = vi.mocked(api);
const emptyConversationPage = { items: [], page: 1, page_size: 25, total: 0 };

function renderChat() {
  return render(
    <Chat
      selfId="user-1"
      organizationId="org-1"
      onStarted={vi.fn()}
      onOpened={vi.fn()}
      onContacts={vi.fn()}
      onVoiceSelection={vi.fn()}
    />,
  );
}

function configureEmptyList() {
  apiMock.mockImplementation(((path: string) => {
    if (path === 'chat/broadcast-config') return Promise.reject(new Error('Realtime transport unavailable in this test.'));
    if (path === 'conversations?page=1') return Promise.resolve(emptyConversationPage);
    throw new Error(`Unexpected API request: ${path}`);
  }) as unknown as typeof api);
}

type TestConversation = { id: string; contact: { id: string; name: string }; contact_activity?: 'typing' | 'recording' | 'calling' | null; updated_at: string };
type TestMessage = {
  id: string;
  sequence: number;
  sender_id: string;
  body: string;
  attachment: null;
  reply_to_id: null;
  pinned: boolean;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
};

function testMessage(id: string, sequence: number, senderId: string, body: string, receipt: Pick<TestMessage, 'delivered_at' | 'read_at'> = { delivered_at: null, read_at: null }): TestMessage {
  return {
    id, sequence, sender_id: senderId, body, attachment: null, reply_to_id: null, pinned: false,
    created_at: `2026-11-01T12:${String(sequence).padStart(2, '0')}:00Z`, ...receipt,
  };
}

function configureConversationHistories(
  conversations: TestConversation[],
  histories: Record<string, TestMessage[]>,
  loadHistory: (conversationId: string, attempts: number) => Promise<unknown> = async conversationId => ({
    items: histories[conversationId] || [], next_before: null, next_after: null, receipts: [],
  }),
) {
  const attempts = new Map<string, number>();
  apiMock.mockImplementation(((path: string, method = 'GET') => {
    if (path === 'chat/broadcast-config') return Promise.reject(new Error('Realtime transport unavailable in this test.'));
    if (path === 'conversations?page=1') {
      return Promise.resolve({ items: conversations, page: 1, page_size: 25, total: conversations.length });
    }
    if (path.startsWith('contacts/')) return Promise.resolve({ name: 'Contacto de prueba', presence: 'online' });
    if (path.endsWith('/pinned')) return Promise.resolve({ items: [] });
    if (path.includes('/activity') || path.endsWith('/receipts')) return Promise.resolve({ items: [] });
    const history = path.match(/^conversations\/([^/]+)\/messages(?:\?.*)?$/);
    if (history) {
      const conversationId = history[1];
      const count = (attempts.get(conversationId) || 0) + 1;
      attempts.set(conversationId, count);
      return loadHistory(conversationId, count);
    }
    throw new Error(`Unexpected API request: ${method} ${path}`);
  }) as unknown as typeof api);
  return attempts;
}

beforeEach(() => {
  apiMock.mockReset();
  setLanguage('es');
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setLanguage('es');
});

describe('Chat conversation loading', () => {
  it('shows the empty state after loading a successful empty conversation page', async () => {
    configureEmptyList();

    renderChat();

    expect(await screen.findByRole('heading', { name: 'Sin conversaciones' })).toBeTruthy();
    expect(screen.getByText('Busca un contacto para iniciar una conversación.')).toBeTruthy();
    expect(apiMock).toHaveBeenCalledWith('conversations?page=1');
  });

  it('offers retry and recovers from a conversation-list API error', async () => {
    let attempts = 0;
    apiMock.mockImplementation(((path: string) => {
      if (path === 'chat/broadcast-config') return Promise.reject(new Error('Realtime transport unavailable in this test.'));
      if (path === 'conversations?page=1') {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('No se pudo cargar la lista.'))
          : Promise.resolve(emptyConversationPage);
      }
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    renderChat();

    expect(await screen.findByRole('button', { name: 'Reintentar conversaciones' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar la lista.');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar conversaciones' }));

    expect(await screen.findByRole('heading', { name: 'Sin conversaciones' })).toBeTruthy();
    await waitFor(() => expect(attempts).toBe(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('signals that the current chat session lost authorization after a 401', async () => {
    apiMock.mockImplementation(((path: string) => {
      if (path === 'chat/broadcast-config') return Promise.reject(new Error('Realtime transport unavailable in this test.'));
      if (path === 'conversations?page=1') return Promise.reject(new ApiError(401, 'La sesión ya no es válida.'));
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    const authLost = vi.fn();
    document.addEventListener('srd-chat-auth-lost', authLost);

    try {
      renderChat();
      await waitFor(() => expect(authLost).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('alert').textContent).toContain('La sesión ya no es válida.');
    } finally {
      document.removeEventListener('srd-chat-auth-lost', authLost);
    }
  });
});

describe('Chat conversation history', () => {
  const first: TestConversation = {
    id: 'conversation-1', contact: { id: 'contact-1', name: 'Camila Prueba' }, updated_at: '2026-11-01T12:00:00Z',
  };
  const second: TestConversation = {
    id: 'conversation-2', contact: { id: 'contact-2', name: 'Diego Prueba' }, updated_at: '2026-11-01T12:01:00Z',
  };

  it('loads only the selected conversation history and does not retain the previous thread', async () => {
    configureConversationHistories([first, second], {
      [first.id]: [testMessage('message-1', 1, 'contact-1', 'Mensaje de Camila', { delivered_at: '2026-11-01T12:01:00Z', read_at: null })],
      [second.id]: [testMessage('message-2', 1, 'contact-2', 'Mensaje de Diego', { delivered_at: '2026-11-01T12:02:00Z', read_at: null })],
    });

    const { container } = renderChat();
    await screen.findByRole('button', { name: /Camila Prueba/ });
    fireEvent.click(screen.getByRole('button', { name: /Camila Prueba/ }));
    expect(await screen.findByText('Mensaje de Camila')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Diego Prueba/ }));
    expect(await screen.findByText('Mensaje de Diego')).toBeTruthy();

    expect(apiMock).toHaveBeenCalledWith(`conversations/${second.id}/messages`);
    expect(screen.queryByText('Mensaje de Camila')).toBeNull();
    expect(container.querySelector('.chat-conversations button[aria-current="true"]')?.textContent).toContain('Diego Prueba');
  });

  it('renders history in sequence order with the sender alignment and receipt state', async () => {
    const older = testMessage('message-old', 1, 'contact-1', 'Mensaje recibido primero', {
      delivered_at: '2026-11-01T12:01:00Z', read_at: null,
    });
    const newer = testMessage('message-new', 2, 'user-1', 'Mensaje propio después', {
      delivered_at: '2026-11-01T12:02:00Z', read_at: '2026-11-01T12:03:00Z',
    });
    configureConversationHistories([first], { [first.id]: [newer, older] });

    const { container } = renderChat();
    await screen.findByRole('button', { name: /Camila Prueba/ });
    fireEvent.click(screen.getByRole('button', { name: /Camila Prueba/ }));
    await screen.findByText('Mensaje propio después');

    const rows = Array.from(container.querySelectorAll('.chat-messages > li'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Mensaje recibido primero');
    expect(rows[0].classList.contains('mine')).toBe(false);
    expect(rows[1].textContent).toContain('Mensaje propio después');
    expect(rows[1].classList.contains('mine')).toBe(true);
    expect(rows[1].textContent).toContain('Leído');
  });

  it('offers a retry after history fails and renders the recovered messages', async () => {
    const attempts = configureConversationHistories([first], { [first.id]: [] }, async (_conversationId, count) => {
      if (count === 1) return Promise.reject(new Error('No se pudo cargar el historial.'));
      return Promise.resolve({ items: [testMessage('recovered', 1, 'contact-1', 'Historial recuperado', {
        delivered_at: '2026-11-01T12:01:00Z', read_at: null,
      })], next_before: null, next_after: null, receipts: [] });
    });

    renderChat();
    await screen.findByRole('button', { name: /Camila Prueba/ });
    fireEvent.click(screen.getByRole('button', { name: /Camila Prueba/ }));
    expect(await screen.findByRole('button', { name: 'Reintentar mensajes' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar mensajes' }));

    expect(await screen.findByText('Historial recuperado')).toBeTruthy();
    expect(attempts.get(first.id)).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('merges duplicate messages and receipt updates without losing earlier receipts', async () => {
    const initial = [
      testMessage('message-1', 1, 'user-1', 'Texto original', {
        delivered_at: '2026-11-01T12:01:00Z', read_at: null,
      }),
      testMessage('message-2', 2, 'user-1', 'Mensaje sin cambios', {
        delivered_at: '2026-11-01T12:02:00Z', read_at: null,
      }),
    ];
    const attempts = configureConversationHistories([first], { [first.id]: initial }, async (_conversationId, count) => {
      if (count === 1) return { items: initial, next_before: null, next_after: null, receipts: [] };
      return {
        items: [
          testMessage('message-1', 1, 'user-1', 'Texto actualizado', { delivered_at: null, read_at: null }),
          testMessage('message-3', 3, 'user-1', 'Mensaje nuevo'),
        ],
        next_before: null,
        next_after: null,
        receipts: [
          { id: 'message-1', delivered_at: null, read_at: '2026-11-01T12:04:00Z' },
          { id: 'message-2', delivered_at: null, read_at: null },
        ],
      };
    });

    const { container } = renderChat();
    await screen.findByRole('button', { name: /Camila Prueba/ });
    fireEvent.click(screen.getByRole('button', { name: /Camila Prueba/ }));
    await screen.findByText('Texto original');

    await act(async () => {
      document.dispatchEvent(new Event('srd-chat-change'));
    });

    await screen.findByText('Mensaje nuevo');
    const rows = Array.from(container.querySelectorAll('.chat-messages > li'));
    expect(rows).toHaveLength(3);
    expect(rows.map(row => row.id)).toEqual([
      'chat-message-message-1',
      'chat-message-message-2',
      'chat-message-message-3',
    ]);
    expect(rows[0].textContent).toContain('Texto actualizado');
    expect(rows[0].textContent).not.toContain('Texto original');
    expect(rows[0].querySelector('.chat-bubble-meta span')?.textContent).toBe('Leído');
    expect(rows[1].textContent).toContain('Mensaje sin cambios');
    expect(rows[1].querySelector('.chat-bubble-meta span')?.textContent).toBe('Entregado');
    expect(rows[2].querySelector('.chat-bubble-meta span')?.textContent).toBe('Enviado');
    expect(attempts.get(first.id)).toBe(2);
  });
});

describe('Chat conversation list characterization P43', () => {
  const listConversation = (id: string, name: string, contact_activity?: TestConversation['contact_activity']): TestConversation => ({
    id, contact: { id: `contact-${id}`, name }, contact_activity, updated_at: '2026-11-03T12:00:00Z',
  });

  it('shows a loading status until the conversation page resolves', async () => {
    let resolvePage!: (value: unknown) => void;
    const pendingPage = new Promise(resolve => { resolvePage = resolve; });
    apiMock.mockImplementation(((path: string) => {
      if (path === 'chat/broadcast-config') return Promise.reject(new Error('Realtime transport unavailable in this test.'));
      if (path === 'conversations?page=1') return pendingPage;
      if (path.startsWith('users/') && path.endsWith('/photos/avatar')) return Promise.reject(new Error('No avatar in fixture.'));
      if (path.startsWith('contacts/')) return Promise.resolve({ name: 'Contacto cargado', presence: 'online', person_id: null });
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    renderChat();
    expect(screen.getByRole('status').textContent).toContain('Cargando información');

    resolvePage({ items: [listConversation('loaded', 'Ana Cargada')], page: 1, page_size: 25, total: 1 });
    expect(await screen.findByRole('button', { name: /Ana Cargada/ })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders presence states and activity text with accessible contact names', async () => {
    const conversations = [
      listConversation('online', 'Ana En Línea'),
      listConversation('away', 'Beto Ausente'),
      listConversation('dnd', 'Cata No Molestar'),
      listConversation('invisible', 'Dani Invisible'),
      listConversation('offline', 'Eli Desconectado'),
      listConversation('typing', 'Fabi Escribiendo', 'typing'),
      listConversation('recording', 'Gabi Grabando', 'recording'),
      listConversation('calling', 'Hugo Llamando', 'calling'),
    ];
    const states: Record<string, string> = { online: 'online', away: 'away', dnd: 'dnd', invisible: 'invisible', offline: 'offline' };
    apiMock.mockImplementation(((path: string) => {
      if (path === 'chat/broadcast-config') return Promise.reject(new Error('Realtime transport unavailable in this test.'));
      if (path === 'conversations?page=1') return Promise.resolve({ items: conversations, page: 1, page_size: 25, total: conversations.length });
      const contact = path.match(/^contacts\/contact-(.+)$/);
      if (contact) return Promise.resolve({ name: 'Contacto de prueba', presence: states[contact[1]] || 'online', person_id: null });
      if (path.startsWith('users/') && path.endsWith('/photos/avatar')) return Promise.reject(new Error('No avatar in fixture.'));
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    const { container } = renderChat();

    for (const name of ['Ana En Línea', 'Beto Ausente', 'Cata No Molestar', 'Dani Invisible', 'Eli Desconectado', 'Fabi Escribiendo', 'Gabi Grabando', 'Hugo Llamando']) {
      expect(await screen.findByRole('button', { name: new RegExp(name) })).toBeTruthy();
    }
    expect(Array.from(container.querySelectorAll('.chat-conversations strong')).map(item => item.textContent)).toEqual([
      'Ana En Línea', 'Beto Ausente', 'Cata No Molestar', 'Dani Invisible', 'Eli Desconectado',
      'Fabi Escribiendo', 'Gabi Grabando', 'Hugo Llamando',
    ]);
    await waitFor(() => expect(container.querySelector('[data-state="dnd"]')).toBeTruthy());
    const labels = Array.from(container.querySelectorAll('.chat-conversations .presence-status'));
    expect(labels.map(label => label.getAttribute('data-state'))).toEqual(['online', 'away', 'dnd', 'invisible', 'offline']);
    expect(labels.map(label => label.textContent?.replace('●', '').trim())).toEqual([
      'En línea', 'Ausente', 'No molestar', 'Desconectado', 'Desconectado',
    ]);
    expect(container.querySelector('.chat-conversations .chat-activity')?.textContent).toBe('Escribiendo…');
    expect(Array.from(container.querySelectorAll('.chat-conversations .chat-activity')).map(item => item.textContent)).toEqual([
      'Escribiendo…', 'Grabando una nota de voz…', 'Llamando…',
    ]);
  });

  it('paginates in both directions and does not mark an off-page selection as current', async () => {
    const first = listConversation('page-one', 'Ana Primera Página');
    const second = listConversation('page-two', 'Beto Segunda Página');
    apiMock.mockImplementation(((path: string) => {
      if (path === 'chat/broadcast-config') return Promise.reject(new Error('Realtime transport unavailable in this test.'));
      if (path === 'conversations?page=1') return Promise.resolve({ items: [first], page: 1, page_size: 1, total: 2 });
      if (path === 'conversations?page=2') return Promise.resolve({ items: [second], page: 2, page_size: 1, total: 2 });
      if (path.startsWith('users/') && path.endsWith('/photos/avatar')) return Promise.reject(new Error('No avatar in fixture.'));
      if (path.startsWith('contacts/')) return Promise.resolve({ name: 'Contacto', presence: 'online', person_id: null });
      if (path.endsWith('/pinned') || path.endsWith('/receipts')) return Promise.resolve({ items: [] });
      if (/^conversations\/[^/]+\/messages(?:\?.*)?$/.test(path)) return Promise.resolve({ items: [], next_before: null, next_after: null, receipts: [] });
      if (path.includes('/activity')) return Promise.resolve({ items: [] });
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    const { container } = renderChat();
    const firstButton = await screen.findByRole('button', { name: /Ana Primera Página/ });
    expect(screen.getByRole('button', { name: 'Conversaciones anteriores' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Conversaciones siguientes' }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(firstButton);
    expect(firstButton.getAttribute('aria-current')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Conversaciones siguientes' }));
    const secondButton = await screen.findByRole('button', { name: /Beto Segunda Página/ });
    expect(screen.getByText('Página 2 de 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Conversaciones anteriores' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Conversaciones siguientes' }).hasAttribute('disabled')).toBe(true);
    expect(secondButton.getAttribute('aria-current')).toBeNull();
    expect(container.querySelectorAll('.chat-conversations > li')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Conversaciones anteriores' }));
    await waitFor(() => expect(container.querySelector('.chat-conversations button')?.textContent).toContain('Ana Primera Página'));
    expect(container.querySelector('.chat-conversations button')?.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
  });

  it('discards a delayed list response when the active organization remounts Chat', async () => {
    let resolveOldPage!: (value: unknown) => void;
    const oldPage = new Promise(resolve => { resolveOldPage = resolve; });
    let listCalls = 0;
    apiMock.mockImplementation(((path: string) => {
      if (path === 'chat/broadcast-config') return Promise.reject(new Error('Realtime transport unavailable in this test.'));
      if (path === 'conversations?page=1') {
        listCalls += 1;
        return listCalls === 1 ? oldPage : Promise.resolve({
          items: [listConversation('org-two', 'Contacto de Junta Dos')], page: 1, page_size: 25, total: 1,
        });
      }
      if (path.startsWith('users/') && path.endsWith('/photos/avatar')) return Promise.reject(new Error('No avatar in fixture.'));
      if (path.startsWith('contacts/')) return Promise.resolve({ name: 'Contacto', presence: 'online', person_id: null });
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    const renderOrganization = (organizationId: string) => <Chat
      key={`${organizationId}:chat`}
      selfId="user-1"
      organizationId={organizationId}
      onStarted={vi.fn()}
      onOpened={vi.fn()}
      onContacts={vi.fn()}
      onVoiceSelection={vi.fn()}
    />;
    const view = render(renderOrganization('org-one'));
    view.rerender(renderOrganization('org-two'));

    expect(await screen.findByRole('button', { name: /Contacto de Junta Dos/ })).toBeTruthy();
    resolveOldPage({ items: [listConversation('org-one', 'Contacto de Junta Uno')], page: 1, page_size: 25, total: 1 });
    await act(async () => { await oldPage; });
    expect(screen.queryByRole('button', { name: /Contacto de Junta Uno/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Contacto de Junta Dos/ })).toBeTruthy();
  });

  it('replaces the conversation page on refresh without duplicating rows', async () => {
    const conversations = [listConversation('refresh-one', 'Ana Actualizada'), listConversation('refresh-two', 'Beto Actualizado')];
    let pageLoads = 0;
    apiMock.mockImplementation(((path: string) => {
      if (path === 'chat/broadcast-config') return Promise.reject(new Error('Realtime transport unavailable in this test.'));
      if (path === 'conversations?page=1') { pageLoads += 1; return Promise.resolve({ items: conversations, page: 1, page_size: 25, total: 2 }); }
      if (path.startsWith('users/') && path.endsWith('/photos/avatar')) return Promise.reject(new Error('No avatar in fixture.'));
      if (path.startsWith('contacts/')) return Promise.resolve({ name: 'Contacto', presence: 'online', person_id: null });
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    const { container } = renderChat();
    await screen.findByRole('button', { name: /Ana Actualizada/ });
    await screen.findByRole('button', { name: /Beto Actualizado/ });
    await act(async () => { document.dispatchEvent(new Event('srd-chat-change')); });
    await waitFor(() => expect(pageLoads).toBe(2));

    expect(container.querySelectorAll('.chat-conversations > li')).toHaveLength(2);
    expect(container.querySelectorAll('.chat-conversations button[aria-current="true"]')).toHaveLength(0);
  });
});
