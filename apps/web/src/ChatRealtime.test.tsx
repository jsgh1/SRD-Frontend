import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api';
import { Chat } from './Chat';

const { pusherInstances } = vi.hoisted(() => ({ pusherInstances: [] as any[] }));

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, api: vi.fn() };
});

vi.mock('pusher-js', () => ({
  default: class FakePusher {
    key: string;
    options: Record<string, any>;
    disconnect = vi.fn();
    channels: Array<{ name: string; handlers: Record<string, () => void>; bind: ReturnType<typeof vi.fn> }> = [];
    constructor(key: string, options: Record<string, any>) {
      this.key = key;
      this.options = options;
      pusherInstances.push(this);
    }
    subscribe(name: string) {
      const handlers: Record<string, () => void> = {};
      const channel = {
        name,
        handlers,
        bind: vi.fn((event: string, callback: () => void) => { handlers[event] = callback; }),
      };
      this.channels.push(channel);
      return channel;
    }
  },
}));

const apiMock = vi.mocked(api);
const originalDocumentHidden = document.hidden;

function renderChat(selfId = 'user-1') {
  return render(<Chat selfId={selfId} organizationId="org-1" onStarted={vi.fn()} onOpened={vi.fn()} onContacts={vi.fn()} onVoiceSelection={vi.fn()} />);
}

function configureApi() {
  apiMock.mockImplementation(((path: string, method = 'GET') => {
    if (path === 'chat/broadcast-config') return Promise.resolve({ key: 'public-test-key', channel: 'private-test-channel' });
    if (path === 'chat/broadcast-auth' && method === 'POST') return Promise.resolve({ auth: 'signed-test-value', channel_data: 'test-channel-data' });
    if (path === 'conversations?page=1') return Promise.resolve({ items: [], page: 1, page_size: 25, total: 0 });
    throw new Error(`Unexpected API request: ${method} ${path}`);
  }) as unknown as typeof api);
}

beforeEach(() => {
  apiMock.mockReset();
  pusherInstances.length = 0;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(document, 'hidden', { configurable: true, value: originalDocumentHidden });
});

describe('Chat realtime lifecycle characterization', () => {
  it('loads broadcast configuration and subscribes to the configured private channel once', async () => {
    configureApi();
    renderChat();

    await waitFor(() => expect(pusherInstances).toHaveLength(1));
    expect(pusherInstances[0].key).toBe('public-test-key');
    expect(pusherInstances[0].channels.map((channel: { name: string }) => channel.name)).toEqual(['private-test-channel']);
    expect(pusherInstances[0].channels[0].bind).toHaveBeenCalledWith('chat.changed', expect.any(Function));
  });

  it('uses the authenticated HTTP callback for private-channel authorization', async () => {
    configureApi();
    renderChat();
    await waitFor(() => expect(pusherInstances).toHaveLength(1));
    const callback = vi.fn();
    const handler = pusherInstances[0].options.channelAuthorization.customHandler;

    await act(async () => {
      handler({ socketId: 'socket-test-1', channelName: 'private-test-channel' }, callback);
    });

    expect(apiMock).toHaveBeenCalledWith('chat/broadcast-auth', 'POST', {
      socket_id: 'socket-test-1', channel_name: 'private-test-channel',
    });
    expect(callback).toHaveBeenCalledWith(null, { auth: 'signed-test-value', channel_data: 'test-channel-data' });
  });

  it('signals authorization loss and disconnects when channel authorization is rejected', async () => {
    configureApi();
    apiMock.mockImplementation(((path: string, method = 'GET') => {
      if (path === 'chat/broadcast-config') return Promise.resolve({ key: 'public-test-key', channel: 'private-test-channel' });
      if (path === 'chat/broadcast-auth' && method === 'POST') return Promise.reject(new ApiError(401, 'Unauthorized'));
      if (path === 'conversations?page=1') return Promise.resolve({ items: [], page: 1, page_size: 25, total: 0 });
      throw new Error(`Unexpected API request: ${method} ${path}`);
    }) as unknown as typeof api);
    const authLost = vi.fn();
    document.addEventListener('srd-chat-auth-lost', authLost);
    try {
      renderChat();
      await waitFor(() => expect(pusherInstances).toHaveLength(1));
      const callback = vi.fn();

      await act(async () => {
        pusherInstances[0].options.channelAuthorization.customHandler(
          { socketId: 'socket-test-2', channelName: 'private-test-channel' }, callback,
        );
      });

      expect(authLost).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.any(Error), null);
      expect(pusherInstances[0].disconnect).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('srd-chat-auth-lost', authLost);
    }
  });

  it('disconnects while hidden and reconnects once the tab becomes visible', async () => {
    configureApi();
    renderChat();
    await waitFor(() => expect(pusherInstances).toHaveLength(1));

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(pusherInstances[0].disconnect).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(pusherInstances).toHaveLength(2));
    expect(apiMock.mock.calls.filter(([path]) => path === 'chat/broadcast-config')).toHaveLength(2);
  });

  it('does not create duplicate sockets for repeated visible events while connected', async () => {
    configureApi();
    renderChat();
    await waitFor(() => expect(pusherInstances).toHaveLength(1));

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(pusherInstances).toHaveLength(1);
    expect(apiMock.mock.calls.filter(([path]) => path === 'chat/broadcast-config')).toHaveLength(1);
  });

  it('ignores a configuration response that arrives after the tab is hidden', async () => {
    let resolveConfiguration!: (value: { key: string; channel: string }) => void;
    apiMock.mockImplementation(((path: string) => {
      if (path === 'chat/broadcast-config') return new Promise(resolve => { resolveConfiguration = resolve; });
      if (path === 'conversations?page=1') return Promise.resolve({ items: [], page: 1, page_size: 25, total: 0 });
      throw new Error(`Unexpected API request: GET ${path}`);
    }) as unknown as typeof api);
    renderChat();
    await waitFor(() => expect(resolveConfiguration).toBeTypeOf('function'));

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => resolveConfiguration({ key: 'late-key', channel: 'late-channel' }));

    expect(pusherInstances).toHaveLength(0);
  });

  it('ignores an older configuration response after the identity changes', async () => {
    const resolvers: Array<(value: { key: string; channel: string }) => void> = [];
    apiMock.mockImplementation(((path: string) => {
      if (path === 'chat/broadcast-config') return new Promise(resolve => { resolvers.push(resolve); });
      if (path === 'conversations?page=1') return Promise.resolve({ items: [], page: 1, page_size: 25, total: 0 });
      throw new Error(`Unexpected API request: GET ${path}`);
    }) as unknown as typeof api);
    const view = renderChat();
    await waitFor(() => expect(resolvers).toHaveLength(1));
    view.rerender(<Chat selfId="user-2" organizationId="org-1" onStarted={vi.fn()} onOpened={vi.fn()} onContacts={vi.fn()} onVoiceSelection={vi.fn()} />);
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => resolvers[1]({ key: 'current-key', channel: 'current-channel' }));
    await waitFor(() => expect(pusherInstances).toHaveLength(1));
    await act(async () => resolvers[0]({ key: 'stale-key', channel: 'stale-channel' }));

    expect(pusherInstances).toHaveLength(1);
    expect(pusherInstances[0].key).toBe('current-key');
    expect(pusherInstances[0].channels[0].name).toBe('current-channel');
  });

  it('disconnects on unmount and removes visibility handling', async () => {
    configureApi();
    const view = renderChat();
    await waitFor(() => expect(pusherInstances).toHaveLength(1));
    view.unmount();
    expect(pusherInstances[0].disconnect).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(pusherInstances).toHaveLength(1);
  });

  it('disconnects the prior identity socket and opens one connection for the new identity', async () => {
    configureApi();
    const view = renderChat();
    await waitFor(() => expect(pusherInstances).toHaveLength(1));

    view.rerender(<Chat selfId="user-2" organizationId="org-1" onStarted={vi.fn()} onOpened={vi.fn()} onContacts={vi.fn()} onVoiceSelection={vi.fn()} />);
    await waitFor(() => expect(pusherInstances).toHaveLength(2));

    expect(pusherInstances[0].disconnect).toHaveBeenCalledTimes(1);
    expect(pusherInstances[1].key).toBe('public-test-key');
  });

  it('notifies the chat refresh listener when a subscribed change event arrives', async () => {
    configureApi();
    renderChat();
    await waitFor(() => expect(pusherInstances).toHaveLength(1));
    const changed = vi.fn();
    document.addEventListener('srd-chat-change', changed);
    try {
      act(() => pusherInstances[0].channels[0].handlers['chat.changed']());
      expect(changed).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('srd-chat-change', changed);
    }
  });

  it('ignores a queued change event from a socket after the tab has disconnected', async () => {
    configureApi();
    renderChat();
    await waitFor(() => expect(pusherInstances).toHaveLength(1));
    const changed = vi.fn();
    const queuedHandler = pusherInstances[0].channels[0].handlers['chat.changed'];
    document.addEventListener('srd-chat-change', changed);
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      act(() => queuedHandler());

      expect(pusherInstances[0].disconnect).toHaveBeenCalledOnce();
      expect(changed).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('srd-chat-change', changed);
    }
  });
});
