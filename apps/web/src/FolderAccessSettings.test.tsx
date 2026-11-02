import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { FolderAccessSettings } from './FolderAccessSettings';
import { setLanguage } from './i18n';

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, api: vi.fn() };
});

const apiMock = vi.mocked(api);
const settings = {
  version: 4,
  reader_roles: [],
  reader_memberships: [],
  can_manage: true,
  can_read: true,
};
const reader = {
  id: 'membership-7',
  version: 2,
  role: 'viewer',
  name: 'Camila Ruiz',
  email: 'camila@example.test',
};
const listing = { items: [reader], total: 1, page: 1, page_size: 25 };

beforeEach(() => {
  apiMock.mockReset();
  setLanguage('es');
});

afterEach(() => {
  cleanup();
  setLanguage('es');
});

describe('FolderAccessSettings', () => {
  it('loads eligible readers and saves versioned role and membership grants', async () => {
    const updated = {
      ...settings,
      version: 5,
      reader_roles: ['viewer'],
      reader_memberships: [{ id: reader.id, version: reader.version }],
    };
    apiMock.mockImplementation((async (path: string, method = 'GET', body?: unknown) => {
      if (path === 'folder-access' && method === 'GET') return settings;
      if (path === 'members/folder-readers?page=1') return listing;
      if (path === 'folder-access' && method === 'PUT') return updated;
      throw new Error(`Unexpected API request: ${method} ${path} ${JSON.stringify(body ?? {})}`);
    }) as unknown as typeof api);

    render(<FolderAccessSettings />);

    const readerCheckbox = await screen.findByRole('checkbox', { name: /Camila Ruiz/ });
    const viewerRole = screen.getByRole('checkbox', { name: 'Consultor' });
    const save = screen.getByRole('button', { name: 'Guardar permisos' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.click(viewerRole);
    fireEvent.click(readerCheckbox);
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('folder-access', 'PUT', {
      version: 4,
      reader_roles: ['viewer'],
      reader_memberships: [reader.id],
    }));
    expect(await screen.findByText('Permisos de lectura de Carpeta guardados.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Guardar permisos' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('applies a trimmed email search only after the user submits it', async () => {
    const empty = { items: [], total: 0, page: 1, page_size: 25 };
    const match = { ...listing, items: [{ ...reader, name: 'Ana Ruiz', email: 'ana@example.test' }] };
    apiMock.mockImplementation((async (path: string, method = 'GET') => {
      if (path === 'folder-access' && method === 'GET') return settings;
      if (path === 'members/folder-readers?page=1') return empty;
      if (path === 'members/folder-readers?page=1&search=ana%40example.test') return match;
      throw new Error(`Unexpected API request: ${method} ${path}`);
    }) as unknown as typeof api);

    render(<FolderAccessSettings />);

    expect(await screen.findByText('No hay miembros activos con ese criterio.')).toBeTruthy();
    const search = screen.getByRole('textbox', { name: 'Buscar miembro para Carpeta' });
    fireEvent.change(search, { target: { value: '  ana@example.test  ' } });
    expect(apiMock).not.toHaveBeenCalledWith('members/folder-readers?page=1&search=ana%40example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByRole('checkbox', { name: /Ana Ruiz/ })).toBeTruthy();
    expect(apiMock).toHaveBeenCalledWith('members/folder-readers?page=1&search=ana%40example.test');
  });
});