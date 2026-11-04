import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { setLanguage } from './i18n';
import { Chat } from './Chat';

const { convertRecording } = vi.hoisted(() => ({ convertRecording: vi.fn() }));

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, api: vi.fn() };
});
vi.mock('./voiceNote', () => ({ recordedBlobToWav: convertRecording }));

const apiMock = vi.mocked(api);
const originalMediaDevices = navigator.mediaDevices;
const originalDocumentHidden = document.hidden;

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  constructor() { FakeMediaRecorder.instances.push(this); }
  state: RecordingState = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn(() => { this.state = 'recording'; });
  pause = vi.fn(() => { this.state = 'paused'; });
  resume = vi.fn(() => { this.state = 'recording'; });
  stop = vi.fn(() => {
    this.state = 'inactive';
    this.onstop?.();
  });
  emitData(data: Blob) {
    this.ondataavailable?.({ data } as BlobEvent);
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  close = vi.fn(async () => undefined);
  createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
  createAnalyser = vi.fn(() => ({
    fftSize: 0,
    getByteTimeDomainData: (samples: Uint8Array) => samples.fill(128),
  }));
  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

const conversations = [
  { id: 'conversation-1', contact: { id: 'contact-1', name: 'Ana Prueba' }, updated_at: '2026-11-03T12:00:00Z' },
  { id: 'conversation-2', contact: { id: 'contact-2', name: 'Luis Prueba' }, updated_at: '2026-11-03T12:01:00Z' },
];

function createStream() {
  const stop = vi.fn();
  const track = { stop };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, stop };
}

function configureApi() {
  apiMock.mockImplementation(((path: string, method = 'GET') => {
    if (path === 'chat/broadcast-config') return Promise.reject(new Error('Realtime intentionally disabled in recorder tests.'));
    if (path === 'conversations?page=1') return Promise.resolve({ items: conversations, page: 1, page_size: 25, total: conversations.length });
    if (path.startsWith('contacts/')) return Promise.resolve({ name: 'Contacto de prueba', presence: 'online', person_id: null });
    if (path.endsWith('/pinned')) return Promise.resolve({ items: [] });
    if (path.includes('/activity') || path.endsWith('/receipts')) return Promise.resolve({ items: [] });
    if (/^conversations\/[^/]+\/messages(?:\?.*)?$/.test(path)) {
      return Promise.resolve({ items: [], next_before: null, next_after: null, receipts: [] });
    }
    throw new Error('Unexpected API request: ' + method + ' ' + path);
  }) as unknown as typeof api);
}

function renderChat() {
  return render(<Chat selfId="user-1" organizationId="org-1" onStarted={vi.fn()} onOpened={vi.fn()} onContacts={vi.fn()} onVoiceSelection={vi.fn()} />);
}

async function openConversation(name = 'Ana Prueba') {
  configureApi();
  const view = renderChat();
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  await screen.findByRole('button', { name: 'Grabar nota de voz' });
  return view;
}

async function startRecording() {
  fireEvent.click(screen.getByRole('button', { name: 'Grabar nota de voz' }));
  await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
  expect(screen.getByText('Grabando nota de voz')).toBeTruthy();
}

beforeEach(() => {
  apiMock.mockReset();
  convertRecording.mockReset();
  convertRecording.mockResolvedValue(new File(['wav'], 'nota-de-voz.wav', { type: 'audio/wav' }));
  FakeMediaRecorder.instances = [];
  FakeAudioContext.instances = [];
  setLanguage('es');
  const getUserMedia = vi.fn(async () => createStream().stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(document, 'hidden', { configurable: true, value: originalDocumentHidden });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices });
  setLanguage('es');
});

describe('Chat voice recording characterization', () => {
  it('reports unsupported browser recording without requesting a microphone', async () => {
    await openConversation();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} });
    vi.stubGlobal('MediaRecorder', undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Grabar nota de voz' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Este navegador no permite grabar');
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it('reports a denied microphone permission and does not create a recorder', async () => {
    await openConversation();
    const getUserMedia = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });

    fireEvent.click(screen.getByRole('button', { name: 'Grabar nota de voz' }));

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo acceder al micr');
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it('starts recording, pauses, resumes, stops, converts to WAV and releases microphone resources', async () => {
    const { stream, stop } = createStream();
    const getUserMedia = vi.fn(async () => stream);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    await openConversation();

    await startRecording();
    const recorder = FakeMediaRecorder.instances[0];
    const pause = screen.getByRole('button', { name: 'Pausar grabación' });
    fireEvent.click(pause);
    expect(recorder.pause).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar grabación' }));
    expect(recorder.resume).toHaveBeenCalledOnce();

    recorder.emitData(new Blob(['synthetic audio'], { type: 'audio/webm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminar grabación' }));

    await waitFor(() => expect(convertRecording).toHaveBeenCalledOnce());
    expect(convertRecording.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(await screen.findByText('nota-de-voz.wav')).toBeTruthy();
    expect(screen.queryByText('Grabando nota de voz')).toBeNull();
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();
    expect(recorder.state).toBe('inactive');
  });

  it('discards recording without converting or retaining the captured audio', async () => {
    const { stream, stop } = createStream();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    await openConversation();
    await startRecording();
    FakeMediaRecorder.instances[0].emitData(new Blob(['synthetic'], { type: 'audio/webm' }));

    fireEvent.click(screen.getByRole('button', { name: 'Descartar grabación' }));

    expect(stop).toHaveBeenCalledOnce();
    expect(convertRecording).not.toHaveBeenCalled();
    expect(screen.queryByText('Grabando nota de voz')).toBeNull();
  });

  it('stops the microphone stream if the conversation changes while permission is pending', async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const pendingStream = new Promise<MediaStream>(resolve => { resolveStream = resolve; });
    const { stream, stop } = createStream();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(() => pendingStream) } });
    await openConversation();

    fireEvent.click(screen.getByRole('button', { name: 'Grabar nota de voz' }));
    fireEvent.click(await screen.findByRole('button', { name: /Luis Prueba/ }));
    await act(async () => { resolveStream(stream); await pendingStream; });

    expect(stop).toHaveBeenCalledOnce();
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(screen.queryByText('Grabando nota de voz')).toBeNull();
  });

  it('cancels an active recorder and does not convert it after switching conversations', async () => {
    const { stream, stop } = createStream();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    await openConversation();
    await startRecording();
    const recorder = FakeMediaRecorder.instances[0];

    fireEvent.click(await screen.findByRole('button', { name: /Luis Prueba/ }));

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(convertRecording).not.toHaveBeenCalled();
    expect(screen.queryByText('Grabando nota de voz')).toBeNull();
  });

  it('discards the active recording when the browser tab becomes hidden', async () => {
    const { stream, stop } = createStream();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    await openConversation();
    await startRecording();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });

    fireEvent(document, new Event('visibilitychange'));

    expect(FakeMediaRecorder.instances[0].stop).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(convertRecording).not.toHaveBeenCalled();
  });

  it('releases tracks and audio analysis when Chat unmounts during recording', async () => {
    const { stream, stop } = createStream();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    const view = await openConversation();
    await startRecording();

    view.unmount();

    expect(FakeMediaRecorder.instances[0].stop).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();
    expect(convertRecording).not.toHaveBeenCalled();
  });

  it('automatically stops at the existing 120-second recording limit', async () => {
    const { stream, stop } = createStream();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    await openConversation();
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Grabar nota de voz' }));
      await Promise.resolve();
    });
    const recorder = FakeMediaRecorder.instances[0];
    expect(recorder).toBeTruthy();
    vi.setSystemTime(Date.now() + 120_000);
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('discards an audio recording that exceeds 10 MB', async () => {
    const { stream, stop } = createStream();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    await openConversation();
    await startRecording();
    const recorder = FakeMediaRecorder.instances[0];

    act(() => recorder.emitData(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'audio/webm' })));

    expect((await screen.findByRole('alert')).textContent).toContain('10 MB');
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(convertRecording).not.toHaveBeenCalled();
  });

  it('reports WAV conversion failures and never attaches a failed result', async () => {
    convertRecording.mockRejectedValueOnce(new Error('decode failed'));
    const { stream } = createStream();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    await openConversation();
    await startRecording();
    FakeMediaRecorder.instances[0].emitData(new Blob(['synthetic'], { type: 'audio/webm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminar grabación' }));

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo preparar la nota de voz');
    expect(screen.queryByText('nota-de-voz.wav')).toBeNull();
  });

  it('does not attach a converted recording after the conversation changed', async () => {
    let resolveWav!: (file: File) => void;
    convertRecording.mockReturnValueOnce(new Promise<File>(resolve => { resolveWav = resolve; }));
    const { stream } = createStream();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    await openConversation();
    await startRecording();
    FakeMediaRecorder.instances[0].emitData(new Blob(['synthetic'], { type: 'audio/webm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminar grabación' }));
    await waitFor(() => expect(convertRecording).toHaveBeenCalledOnce());

    fireEvent.click(await screen.findByRole('button', { name: /Luis Prueba/ }));
    await act(async () => {
      resolveWav(new File(['wav'], 'obsoleta.wav', { type: 'audio/wav' }));
    });

    expect(screen.queryByText('obsoleta.wav')).toBeNull();
  });

  it('releases microphone resources after successful conversion as well as stopping the recorder', async () => {
    const { stream, stop } = createStream();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => stream) } });
    await openConversation();
    await startRecording();
    fireEvent.click(screen.getByRole('button', { name: 'Terminar grabación' }));

    await screen.findByText('nota-de-voz.wav');
    expect(stop).toHaveBeenCalledOnce();
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();
  });
});
