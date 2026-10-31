import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, type Principal } from './api';
import { PersonDetail } from './Persons';
import type { Person } from './personTypes';
import { setLanguage } from './i18n';

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, api: vi.fn() };
});

vi.mock('./ui', async importOriginal => {
  const actual = await importOriginal<typeof import('./ui')>();
  return {
    ...actual,
    Modal: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <section role="dialog" aria-label={title}>{children}</section>
    ),
  };
});

vi.mock('./PersonFields', () => ({ AdditionalDetail: () => null, AdditionalInputs: () => null }));
vi.mock('./PersonPhotos', () => ({ PersonPhotos: () => null }));
vi.mock('./PersonForm', () => ({ PersonForm: () => null }));

const apiMock = vi.mocked(api);
const principal = {
  user_id: 'registrar-1',
  role: 'registrar',
  user: { name: 'Ana', email: 'ana@example.test', theme: 'light', presence: 'online', language: 'es' },
  organization: { id: 'org-1', code: 'junta-prueba', name: 'Junta de prueba' },
  terms_required: false,
} as Principal;
const person = {
  id: 'person-1',
  first_names: 'Ana',
  last_names: 'Pérez',
  document_type: 'CC',
  document_number: '123456789',
  email: 'ana.persona@example.test',
  status: 'complete',
  version: 2,
  created_at: '2026-10-30 18:00:00',
  custom_fields: [],
} as Person;

function respond(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  if (path === 'invitations/person/person-1/status') return Promise.resolve({ status: 'available' });
  if (path === 'persons/person-1') return Promise.resolve(person);
  if (path === 'persons/person-1/photos') return Promise.resolve({ items: [] });
  if (path === 'invitations' && method === 'POST') return Promise.resolve({ id: 'invitation-1' });
  throw new Error(`Unexpected API request: ${method} ${path} ${JSON.stringify(body ?? {})}`);
}

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation(((path: string, method?: string, body?: unknown) => respond(path, method, body)) as unknown as typeof api);
  setLanguage('es');
});

afterEach(() => {
  cleanup();
  setLanguage('es');
});

describe('PersonDetail access invitation behavior', () => {
  it('limits a registrar to the viewer role and marks the invitation pending after sending', async () => {
    render(<PersonDetail id="person-1" principal={principal} onClose={vi.fn()} />);

    expect(await screen.findByText('Ana Pérez')).toBeTruthy();
    const access = screen.getByRole('heading', { name: 'Acceso al sistema' }).closest('section');
    expect(access).toBeTruthy();

    const role = within(access!).getByRole('combobox', { name: 'Rol de acceso' }) as HTMLSelectElement;
    expect(Array.from(role.options).map(option => option.value)).toEqual(['viewer']);

    fireEvent.click(within(access!).getByRole('button', { name: 'Enviar invitación' }));

    expect(await within(access!).findByText('Esta persona ya tiene una invitación pendiente.')).toBeTruthy();
    expect(apiMock).toHaveBeenCalledWith('invitations', 'POST', {
      person_id: 'person-1',
      email: 'ana.persona@example.test',
      role: 'viewer',
    });
  });

  it('hides access invitation controls when an account is already active for the person', async () => {
    apiMock.mockImplementation(((path: string) => {
      if (path === 'invitations/person/person-1/status') return Promise.resolve({ status: 'active' });
      if (path === 'persons/person-1') return Promise.resolve(person);
      if (path === 'persons/person-1/photos') return Promise.resolve({ items: [] });
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    render(<PersonDetail id="person-1" principal={principal} onClose={vi.fn()} />);

    expect(await screen.findByText('Ana Pérez')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Acceso al sistema' })).toBeNull());
    expect(apiMock).not.toHaveBeenCalledWith('invitations', 'POST', expect.anything());
  });

  it('shows a recoverable detail error and reloads the person when retry is selected', async () => {
    let detailRequests = 0;
    apiMock.mockImplementation(((path: string, method?: string, body?: unknown) => {
      if (path === 'invitations/person/person-1/status') return Promise.resolve({ status: 'available' });
      if (path === 'persons/person-1') {
        detailRequests += 1;
        return detailRequests === 1
          ? Promise.reject(new ApiError(503, 'Un servicio necesario no está disponible. Intenta más tarde.'))
          : Promise.resolve(person);
      }
      if (path === 'persons/person-1/photos') return Promise.resolve({ items: [] });
      throw new Error(`Unexpected API request: ${method ?? 'GET'} ${path} ${JSON.stringify(body ?? {})}`);
    }) as unknown as typeof api);

    render(<PersonDetail id="person-1" principal={principal} onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar detalle' }));

    expect(await screen.findByText('Ana Pérez')).toBeTruthy();
    expect(detailRequests).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
