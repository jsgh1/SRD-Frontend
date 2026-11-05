import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type Principal } from './api';
import { setLanguage } from './i18n';
import { Dashboard } from './Dashboard';

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, api: vi.fn() };
});

vi.mock('./QuickLinks', async importOriginal => {
  const actual = await importOriginal<typeof import('./QuickLinks')>();
  return { ...actual, QuickLinks: () => null };
});

const apiMock = vi.mocked(api);
const principal = {
  user_id: 'user-1',
  role: 'registrar',
  user: { name: 'Ana', email: 'ana@example.test', theme: 'light', presence: 'online', language: 'es' },
  organization: { id: 'org-1', code: 'junta-prueba', name: 'Junta de prueba' },
  terms_required: false,
} as Principal;
const data = {
  date: '2026-10-30',
  generated_at: '2026-10-30T15:00:00Z',
  total: 5,
  today: 1,
  week: 2,
  month: 5,
  last_seven_days: [{ date: '2026-10-30', count: 2 }],
  gender: [],
  document_types: [],
  latest: [],
};

beforeEach(() => {
  apiMock.mockReset();
  setLanguage('es');
});

afterEach(() => {
  cleanup();
  setLanguage('es');
});

describe('Dashboard', () => {
  it('loads the junta metrics, shows empty-state guidance, and refreshes on request', async () => {
    apiMock.mockResolvedValue(data as never);
    const navigate = vi.fn();
    render(<Dashboard principal={principal} navigate={navigate} />);

    const count = await screen.findByText('Personas registradas');
    expect(within(count.closest('article')!).getByText('5')).toBeTruthy();
    expect(screen.getByText('Registradas hoy')).toBeTruthy();
    expect(screen.getByText('Bienvenido al panel de Junta de prueba.')).toBeTruthy();
    expect(screen.getByText(/Tu registro comunitario empieza/)).toBeTruthy();
    expect(apiMock).toHaveBeenCalledWith('dashboard', 'GET', undefined, expect.objectContaining({ signal: expect.any(AbortSignal) }));

    fireEvent.click(screen.getByRole('button', { name: 'Ver lista completa' }));
    expect(navigate).toHaveBeenCalledWith('list');

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar indicadores' }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
  });

  it('uses the selected English copy for dashboard metrics and actions', async () => {
    setLanguage('en');
    apiMock.mockResolvedValue(data as never);
    render(<Dashboard principal={principal} navigate={vi.fn()} />);

    expect(await screen.findByText('Registered people')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh indicators' })).toBeTruthy();
  });
});