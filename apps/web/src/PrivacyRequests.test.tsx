import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { setLanguage } from './i18n';
import { PrivacyRequests } from './PrivacyRequests';

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, api: vi.fn() };
});

const apiMock = vi.mocked(api);

function request(id: string, summary = `Solicitud sintética ${id}`) {
  return {
    id,
    person_id: `person-${id}`,
    first_names: 'Persona',
    last_names: 'Sintética',
    document_number: `DOC-${id}`,
    kind: 'access',
    status: 'open',
    summary,
    decision: null,
    responsible_id: null,
    decided_at: null,
    created_at: '2026-11-02T12:00:00.000Z',
    version: 1,
    history: [],
  };
}

function page(items: ReturnType<typeof request>[], total = items.length, pageSize = 25) {
  return { items, total, page_size: pageSize };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  apiMock.mockReset();
  setLanguage('es');
});

afterEach(() => {
  cleanup();
  setLanguage('es');
});

describe('PrivacyRequests', () => {
  it('clears loading and shows the genuine empty state without exposing nonexistent actions', async () => {
    apiMock.mockResolvedValue(page([]) as never);

    render(<PrivacyRequests userId="admin-synthetic" />);

    expect(await screen.findByText('Aún no hay solicitudes de privacidad.')).toBeTruthy();
    expect(screen.queryByText('Cargando información…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ejecutar supresión' })).toBeNull();
    expect(apiMock).toHaveBeenCalledExactlyOnceWith('privacy-requests?page=1');
    expect(apiMock.mock.calls.some(([path]) => String(path).includes('execute-erasure'))).toBe(false);
  });

  it('shows a list error without stale rows and recovers through the existing refresh action', async () => {
    apiMock.mockRejectedValueOnce(new Error('Fallo sintético de lectura'))
      .mockResolvedValueOnce(page([]) as never);

    render(<PrivacyRequests userId="admin-synthetic" />);

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Fallo sintético de lectura');
    expect(screen.queryByText('Aún no hay solicitudes de privacidad.')).toBeNull();
    expect(screen.queryByText(/Solicitud sintética/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar solicitudes' }));

    expect(await screen.findByText('Aún no hay solicitudes de privacidad.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(apiMock).toHaveBeenCalledTimes(2);
  });

  it('sends the selected type and status filters and resets pagination to the first page', async () => {
    const calls: string[] = [];
    apiMock.mockImplementation(async path => {
      calls.push(String(path));
      const params = new URLSearchParams(String(path).split('?')[1]);
      const currentPage = Number(params.get('page'));
      return page([request(`page-${currentPage}`)], 3, 1) as never;
    });

    render(<PrivacyRequests userId="admin-synthetic" />);
    expect(await screen.findByText('Solicitud sintética page-1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Solicitudes siguientes' }));
    expect(await screen.findByText('Solicitud sintética page-2')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Filtrar por tipo'), { target: { value: 'erasure' } });
    await waitFor(() => {
      const params = new URLSearchParams(calls.at(-1)?.split('?')[1]);
      expect(params.get('page')).toBe('1');
      expect(params.get('kind')).toBe('erasure');
    });

    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'resolved' } });
    await waitFor(() => {
      const params = new URLSearchParams(calls.at(-1)?.split('?')[1]);
      expect(params.get('page')).toBe('1');
      expect(params.get('kind')).toBe('erasure');
      expect(params.get('status')).toBe('resolved');
    });
  });

  it('corrects a page that becomes out of range after the server result changes', async () => {
    const calls: string[] = [];
    apiMock.mockImplementation(async path => {
      const value = String(path);
      calls.push(value);
      const currentPage = Number(new URLSearchParams(value.split('?')[1]).get('page'));
      if (currentPage === 3) return page([], 0, 20) as never;
      return page([request(`page-${currentPage}`)], 60, 20) as never;
    });

    render(<PrivacyRequests userId="admin-synthetic" />);
    expect(await screen.findByText('Solicitud sintética page-1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Solicitudes siguientes' }));
    expect(await screen.findByText('Solicitud sintética page-2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Solicitudes siguientes' }));

    expect(await screen.findByText('Solicitud sintética page-1')).toBeTruthy();
    await waitFor(() => expect(calls).toContain('privacy-requests?page=3'));
    await waitFor(() => expect(calls.at(-1)).toBe('privacy-requests?page=1'));
    expect(screen.getByText('Página 1 de 3')).toBeTruthy();
  });

  it('keeps the newest list result when an older request resolves afterward', async () => {
    const older = deferred<ReturnType<typeof page>>();
    const newer = deferred<ReturnType<typeof page>>();
    apiMock.mockReturnValueOnce(older.promise as never).mockReturnValueOnce(newer.promise as never);

    render(<PrivacyRequests userId="admin-synthetic" />);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar solicitudes' }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));

    await act(async () => newer.resolve(page([request('newer', 'Resultado más reciente')]) as never));
    expect(await screen.findByText('Resultado más reciente')).toBeTruthy();

    await act(async () => older.resolve(page([request('older', 'Resultado obsoleto')]) as never));
    expect(screen.getByText('Resultado más reciente')).toBeTruthy();
    expect(screen.queryByText('Resultado obsoleto')).toBeNull();
  });
});
