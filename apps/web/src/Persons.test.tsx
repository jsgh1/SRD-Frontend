import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, type Principal } from './api';
import { Persons, PersonTable } from './Persons';
import type { Person } from './personTypes';
import { setLanguage } from './i18n';

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, api: vi.fn() };
});

vi.mock('./PersonFields', () => ({ AdditionalDetail: () => null, AdditionalInputs: () => null }));
vi.mock('./PersonPhotos', () => ({ PersonPhotos: () => null }));
vi.mock('./PersonForm', () => ({ PersonForm: () => null }));
vi.mock('./Planilla', () => ({ Planilla: () => null }));
vi.mock('./PersonFilters', () => ({ PersonFilters: () => null }));

const person = {
  id: 'person-1',
  first_names: 'Ana',
  last_names: 'Pérez',
  document_type: 'CC',
  document_number: '123456789',
  status: 'complete',
  version: 2,
  created_at: '2026-10-30 18:00:00',
} as Person;

const principal = {
  user_id: 'admin-1',
  role: 'admin',
  user: { name: 'Ana', email: 'ana@example.test', theme: 'light', presence: 'online', language: 'es' },
  organization: { id: 'org-1', code: 'junta-prueba', name: 'Junta de prueba' },
  terms_required: false,
} as Principal;

const apiMock = vi.mocked(api);
const filterSettings = {
  version: 1,
  base: ['status', 'zone', 'affiliated'],
  custom: null,
  delegated_roles: [],
  can_manage: false,
  can_delegate: false,
};

function renderPersons(onCreate = vi.fn()) {
  return render(<Persons principal={principal} mode="list" onCreate={onCreate} />);
}

beforeEach(() => {
  localStorage.clear();
  setLanguage('es');
});
afterEach(() => {
  cleanup();
  apiMock.mockReset();
  localStorage.clear();
  setLanguage('es');
});

describe('Persons list behavior', () => {
  it('submits only the selected search criteria to the list endpoint', async () => {
    const requests: string[] = [];
    apiMock.mockImplementation(((path: string) => {
      if (path === 'person-filter-settings') return Promise.resolve(filterSettings);
      if (path.startsWith('persons?page=')) {
        requests.push(path);
        return Promise.resolve({ items: [], total: 0 });
      }
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    renderPersons();
    await waitFor(() => expect(requests).toHaveLength(1));

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'Ana Pérez' } });
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'pending' } });
    fireEvent.change(screen.getByLabelText('Zona'), { target: { value: 'rural' } });
    fireEvent.change(screen.getByLabelText('Afiliación'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => expect(requests).toHaveLength(2));
    const params = new URLSearchParams(requests[1].split('?')[1]);
    expect(params.get('q')).toBe('Ana Pérez');
    expect(params.get('status')).toBe('pending');
    expect(params.get('zone')).toBe('rural');
    expect(params.get('affiliated')).toBe('1');
    expect(params.get('page')).toBe('1');
  });

  it('preserves applied search criteria when changing page size and moving forward', async () => {
    const requests: string[] = [];
    apiMock.mockImplementation(((path: string) => {
      if (path === 'person-filter-settings') return Promise.resolve(filterSettings);
      if (path.startsWith('persons?page=')) {
        requests.push(path);
        return Promise.resolve({ items: [], total: 37 });
      }
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    renderPersons();
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(requests).toHaveLength(2));

    fireEvent.change(screen.getByRole('combobox', { name: 'Filas por página' }), { target: { value: '25' } });
    await waitFor(() => expect(requests).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(requests).toHaveLength(4));

    const params = new URLSearchParams(requests[3].split('?')[1]);
    expect(params.get('q')).toBe('Ana');
    expect(params.get('page')).toBe('2');
    expect(params.get('page_size')).toBe('25');
  });

  it('offers a retry after the list request fails and renders records after recovery', async () => {
    let listRequests = 0;
    apiMock.mockImplementation(((path: string) => {
      if (path === 'person-filter-settings') return Promise.resolve(filterSettings);
      if (path.startsWith('persons?page=')) {
        listRequests += 1;
        return listRequests === 1
          ? Promise.reject(new ApiError(503, 'El servicio no está disponible.'))
          : Promise.resolve({ items: [person], total: 1 });
      }
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    renderPersons();
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar personas' }));

    const list = await screen.findByRole('list', { name: 'Lista de personas' });
    expect(within(list).getByText('Ana Pérez')).toBeTruthy();
    expect(listRequests).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('restores export jobs from the active organization and account storage key', async () => {
    const firstKey = `srd-person-export:${principal.organization.id}:${principal.user_id}`;
    const secondPrincipal = {
      ...principal,
      organization: { ...principal.organization, id: 'org-2' },
    } as Principal;
    const secondKey = `srd-person-export:${secondPrincipal.organization.id}:${secondPrincipal.user_id}`;
    localStorage.setItem(firstKey, '11111111-1111-4111-8111-111111111111');
    localStorage.setItem(secondKey, '22222222-2222-4222-8222-222222222222');
    apiMock.mockImplementation(((path: string) => {
      if (path === 'person-filter-settings') return Promise.resolve(filterSettings);
      if (path.startsWith('persons?page=')) return Promise.resolve({ items: [], total: 0 });
      if (path === 'persons/export-jobs/11111111-1111-4111-8111-111111111111'
        || path === 'persons/export-jobs/22222222-2222-4222-8222-222222222222') {
        return Promise.resolve({
          id: path.endsWith('11111111-1111-4111-8111-111111111111')
            ? '11111111-1111-4111-8111-111111111111'
            : '22222222-2222-4222-8222-222222222222',
          status: 'ready',
          format: 'xlsx',
          count: 1,
          cutoff_at: '2026-11-03T12:00:00Z',
          filename: 'people.xlsx',
        });
      }
      throw new Error(`Unexpected API request: ${path}`);
    }) as unknown as typeof api);

    const first = render(<Persons principal={principal} mode="list" onCreate={vi.fn()} />);
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('persons/export-jobs/11111111-1111-4111-8111-111111111111'));
    expect(apiMock).not.toHaveBeenCalledWith('persons/export-jobs/22222222-2222-4222-8222-222222222222');

    first.unmount();
    render(<Persons principal={secondPrincipal} mode="list" onCreate={vi.fn()} />);
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('persons/export-jobs/22222222-2222-4222-8222-222222222222'));
    expect(apiMock.mock.calls.filter(([path]) => path === 'persons/export-jobs/11111111-1111-4111-8111-111111111111')).toHaveLength(1);
  });
});

describe('PersonTable', () => {
  it('shows the same person in desktop and mobile views and wires permitted actions', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<PersonTable rows={[person]} onView={onView} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Lista de personas' })).toBeTruthy();
    const mobile = within(screen.getByRole('list', { name: 'Lista de personas' }));
    expect(mobile.getByText('Ana Pérez')).toBeTruthy();
    expect(mobile.getByText('CC 123456789')).toBeTruthy();
    expect(mobile.getByText('Completado')).toBeTruthy();
    expect(mobile.getByText('30/10/2026')).toBeTruthy();

    fireEvent.click(mobile.getByRole('button', { name: 'Ver Ana' }));
    fireEvent.click(mobile.getByRole('button', { name: 'Editar Ana' }));
    fireEvent.click(mobile.getByRole('button', { name: 'Eliminar Ana' }));
    expect(onView).toHaveBeenCalledExactlyOnceWith(person);
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(person);
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(person);
  });

  it('translates headings and status while omitting edit and delete actions when unavailable', () => {
    setLanguage('en');
    const onView = vi.fn();
    render(<PersonTable rows={[person]} onView={onView} />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Document' })).toBeTruthy();
    const mobile = within(screen.getByRole('list', { name: 'People' }));
    expect(mobile.getByText('Complete')).toBeTruthy();
    expect(mobile.queryByRole('button', { name: 'Edit Ana' })).toBeNull();
    expect(mobile.queryByRole('button', { name: 'Delete Ana' })).toBeNull();
    fireEvent.click(mobile.getByRole('button', { name: 'View Ana' }));
    expect(onView).toHaveBeenCalledExactlyOnceWith(person);
  });
});
