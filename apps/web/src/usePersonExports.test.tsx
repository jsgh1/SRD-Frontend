import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type Principal } from './api';
import { usePersonExports } from './usePersonExports';

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, api: vi.fn() };
});

const apiMock = vi.mocked(api);
const principal = {
  user_id: 'user-1',
  role: 'admin',
  user: { name: 'Member', email: 'member@example.test', theme: 'light', presence: 'online', language: 'es' },
  organization: { id: 'org-1', code: 'council-test', name: 'Test council' },
  terms_required: false,
} as Principal;
const jobId = '11111111-1111-4111-8111-111111111111';
const job = {
  id: jobId,
  status: 'queued' as const,
  format: 'xlsx' as const,
  count: 501,
  cutoff_at: '2026-11-03T12:00:00Z',
  filename: 'people.xlsx',
};
const options = {
  principal,
  mode: 'list' as const,
  applied: 'status=pending',
  exportName: { name: '', confirmed: false },
  total: 0,
  language: 'es',
};

beforeEach(() => {
  localStorage.clear();
  apiMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('person export jobs', () => {
  it('queues large Excel exports and persists the job for the active account', async () => {
    apiMock.mockResolvedValue(job);
    const { result } = renderHook(() => usePersonExports({ ...options, total: 501 }));

    await act(async () => { await result.current.exportExcel(); });

    expect(apiMock).toHaveBeenCalledWith('persons/export-jobs?status=pending&language=es', 'POST');
    expect(localStorage.getItem('srd-person-export:org-1:user-1')).toBe(jobId);
    expect(result.current.exportJob).toEqual(job);
  });

  it('polls a queued job until it is ready, then stops polling', async () => {
    vi.useFakeTimers();
    let reads = 0;
    apiMock.mockImplementation((async () => {
      reads += 1;
      return reads === 1 ? job : { ...job, status: 'ready' };
    }) as typeof api);
    const { result } = renderHook(() => usePersonExports({ ...options, openExportJobId: jobId }));

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.exportJob?.status).toBe('queued');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); await Promise.resolve(); });
    expect(result.current.exportJob?.status).toBe('ready');
    expect(reads).toBe(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(reads).toBe(2);
  });

  it('rejects a ready download whose MIME does not match its XLSX format', async () => {
    const ready = { ...job, status: 'ready' as const, ticket: 'synthetic-ticket' };
    apiMock.mockImplementation((async (path: string) => {
      if (path === `persons/export-jobs/${jobId}`) return ready;
      if (path === `persons/export-jobs/${jobId}/download?ticket=synthetic-ticket`) {
        return { filename: 'people.xlsx', mime: 'text/html', content: 'aGVsbG8=', count: 501 };
      }
      throw new Error(`Unexpected API request: ${path}`);
    }) as typeof api);
    localStorage.setItem('srd-person-export:org-1:user-1', jobId);
    const restored = renderHook(() => usePersonExports(options));
    await waitFor(() => expect(restored.result.current.exportJob?.status).toBe('ready'));

    await act(async () => { await restored.result.current.downloadExportJob(); });

    expect(restored.result.current.exportError).toBeInstanceOf(Error);
    expect(apiMock).toHaveBeenCalledWith(`persons/export-jobs/${jobId}/download?ticket=synthetic-ticket`);
  });
});
