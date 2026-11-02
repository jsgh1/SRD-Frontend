import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

beforeEach(() => {
  apiMock.mockReset();
  setLanguage('es');
});

afterEach(() => {
  cleanup();
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
