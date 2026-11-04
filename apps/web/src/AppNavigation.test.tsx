import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type Principal } from './api';
import { App } from './App';
import { setLanguage } from './i18n';

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, api: vi.fn() };
});

vi.mock('./Login', () => ({ Login: () => <main data-testid="login-screen" /> }));
vi.mock('./Dashboard', () => ({ Dashboard: () => <section data-testid="dashboard-page" /> }));
vi.mock('./EmailChange', () => ({ EmailChange: () => null }));
vi.mock('./ProfilePhoto', () => ({ ProfilePhoto: () => null }));
vi.mock('./Organizations', () => ({ Organizations: () => null }));
vi.mock('./PlatformAccounts', () => ({ PlatformAccounts: () => null }));
vi.mock('./QuickLinks', () => ({ QuickLinks: () => null, QuickLinkSettings: () => null }));
vi.mock('./PersonFields', () => ({ PersonFieldSettings: () => null }));
vi.mock('./PersonPositions', () => ({ PersonPositionSettings: () => null }));
vi.mock('./PersonFilterSettings', () => ({ PersonFilterSettings: () => null }));
vi.mock('./PlanillaSettings', () => ({ PlanillaSettings: () => null }));
vi.mock('./PrivacyRequests', () => ({ PrivacyRequests: () => null }));
vi.mock('./Presence', () => ({ Presence: () => null }));
vi.mock('./Contacts', () => ({ Contacts: () => null }));
vi.mock('./Chat', () => ({ Chat: () => null }));
vi.mock('./VoiceCall', () => ({ VoiceCall: () => null }));
vi.mock('./GlobalSearch', () => ({ GlobalSearch: () => null }));
vi.mock('./ExportCenter', () => ({ ExportCenter: () => null }));
vi.mock('./ServiceStatus', () => ({ ServiceStatus: () => null }));
vi.mock('./SchedulerAlert', () => ({ SchedulerAlert: () => null }));
vi.mock('./DeliveryAlert', () => ({ DeliveryAlert: () => null }));
vi.mock('./AuditDeliveryAlert', () => ({ AuditDeliveryAlert: () => null }));
vi.mock('./Audit', () => ({ Audit: () => null }));
vi.mock('./Calendar', () => ({ Calendar: () => null }));
vi.mock('./Treasury', () => ({ Treasury: () => <section data-testid="treasury-page" /> }));
vi.mock('./Inventory', () => ({ Inventory: () => <section data-testid="inventory-page" /> }));
vi.mock('./Folders', () => ({ Folders: () => null }));
vi.mock('./FolderAccessSettings', () => ({ FolderAccessSettings: () => null }));
vi.mock('./Notifications', () => ({ Notifications: () => null }));
vi.mock('./Downloads', () => ({ Downloads: () => null }));
vi.mock('./Memberships', () => ({ Memberships: () => null, InvitationAcceptance: () => null }));
vi.mock('./ui', () => ({
  ErrorBox: ({ error }: { error: unknown }) => error
    ? <div role="alert">{error instanceof Error ? error.message : String(error)}</div>
    : null,
  Loading: () => null,
  Modal: ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
    <section role="dialog" aria-label={title}>
      <h2>{title}</h2>
      {children}
      <button type="button" aria-label="Cerrar diálogo" onClick={onClose} />
    </section>
  ),
}));
vi.mock('./Persons', () => ({ Persons: () => null, PersonForm: () => null }));

const apiMock = vi.mocked(api);
let activePrincipal: Principal;
let folderAccessGranted = false;

function principalFor(role: string, organizationId = 'organization-1'): Principal {
  return {
    user_id: `user-${role}`,
    role,
    user: { name: 'Persona de prueba', email: 'persona@example.test', theme: 'light', presence: 'online', language: 'es' },
    organization: {
      id: organizationId,
      code: `junta-${role}`,
      name: 'Junta sintética',
      accent: '#2458c6',
      version: 1,
      terms: { id: 'terms-1', version: 1, body: 'Términos de prueba' },
    },
    terms_required: false,
  };
}

function configureSession(role: string) {
  activePrincipal = principalFor(role);
  folderAccessGranted = false;
  apiMock.mockImplementation(async (path: string) => {
    if (path === 'me') return activePrincipal as never;
    if (path === 'folder-access') return { can_read: folderAccessGranted } as never;
    if (path === 'planilla-settings') return { logo_data: null } as never;
    if (path.endsWith('/photos/person')) throw new Error('No hay foto en la sesión sintética.');
    if (path.endsWith('/photos')) return { items: [] } as never;
    return {} as never;
  });
}

async function navigation() {
  await screen.findByRole('navigation');
  return within(screen.getByRole('navigation'));
}

beforeEach(() => {
  apiMock.mockReset();
  window.history.replaceState({}, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  setLanguage('es');
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  setLanguage('es');
});

describe('navigation visibility by membership role', () => {
  it('keeps registrar actions and hides administrative modules', async () => {
    configureSession('registrar');
    render(<App />);

    const nav = await navigation();
    expect(await nav.findByRole('button', { name: 'Registro' })).toBeTruthy();
    expect(nav.getByRole('button', { name: 'Lista' })).toBeTruthy();
    expect(nav.queryByRole('button', { name: 'Tesorería' })).toBeNull();
    expect(nav.queryByRole('button', { name: 'Inventario' })).toBeNull();
    expect(nav.queryByRole('button', { name: 'Auditoría' })).toBeNull();
    expect(nav.queryByRole('button', { name: 'Carpeta' })).toBeNull();
  });

  it('shows only the modules assigned to treasurer and auditor roles', async () => {
    configureSession('treasurer');
    const { unmount } = render(<App />);

    let nav = await navigation();
    expect(await nav.findByRole('button', { name: 'Tesorería' })).toBeTruthy();
    expect(nav.getByRole('button', { name: 'Inventario' })).toBeTruthy();
    expect(nav.queryByRole('button', { name: 'Auditoría' })).toBeNull();
    expect(nav.queryByRole('button', { name: 'Registro' })).toBeNull();
    unmount();

    configureSession('auditor');
    render(<App />);
    nav = await navigation();
    expect(await nav.findByRole('button', { name: 'Auditoría' })).toBeTruthy();
    expect(nav.queryByRole('button', { name: 'Tesorería' })).toBeNull();
    expect(nav.queryByRole('button', { name: 'Inventario' })).toBeNull();
    expect(nav.queryByRole('button', { name: 'Registro' })).toBeNull();
  });

  it('refreshes delegated folder navigation when access changes', async () => {
    configureSession('viewer');
    render(<App />);

    const nav = await navigation();
    await nav.findByRole('button', { name: 'Lista' });
    expect(nav.queryByRole('button', { name: 'Carpeta' })).toBeNull();

    folderAccessGranted = true;
    fireEvent.focus(window);
    expect(await nav.findByRole('button', { name: 'Carpeta' })).toBeTruthy();

    folderAccessGranted = false;
    fireEvent.focus(window);
    await waitFor(() => expect(nav.queryByRole('button', { name: 'Carpeta' })).toBeNull());
  });
});

describe('settings behavior', () => {
  it('saves profile preferences, reloads the account, and reports success', async () => {
    configureSession('admin');
    apiMock.mockImplementation(async (path: string, method?: string, body?: unknown) => {
      if (path === 'me') return activePrincipal as never;
      if (path === 'folder-access') return { can_read: false } as never;
      if (path === 'planilla-settings') return { logo_data: null } as never;
      if (path === 'profile' && method === 'PATCH') {
        activePrincipal = {
          ...activePrincipal,
          user: { ...activePrincipal.user, ...(body as Partial<Principal['user']>) },
        };
        return {} as never;
      }
      throw new Error(`Unexpected API request: ${method ?? 'GET'} ${path}`);
    });
    render(<App />);

    fireEvent.click((await navigation()).getByRole('button', { name: 'Configuración' }));
    await screen.findByRole('heading', { name: 'Mi perfil' });
    const profile = document.getElementById('settings-profile');
    expect(profile).toBeTruthy();
    fireEvent.change(within(profile!).getByLabelText('Nombre'), { target: { value: 'Ana Actualizada' } });
    fireEvent.change(within(profile!).getByLabelText('Tema'), { target: { value: 'dark' } });
    fireEvent.change(within(profile!).getByLabelText('Idioma'), { target: { value: 'en' } });
    fireEvent.submit(within(profile!).getByRole('button', { name: 'Guardar perfil' }).closest('form')!);

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText('Changes saved.')).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(apiMock).toHaveBeenCalledWith('profile', 'PATCH', expect.objectContaining({
      name: 'Ana Actualizada',
      theme: 'dark',
      language: 'en',
    }));
    expect(apiMock).toHaveBeenCalledWith('me');
  });

  it('shows and hides settings sections according to the active role', async () => {
    configureSession('viewer');
    const viewer = render(<App />);
    fireEvent.click((await navigation()).getByRole('button', { name: 'Configuración' }));
    await screen.findByRole('heading', { name: 'Mi perfil' });
    expect(screen.queryByRole('link', { name: 'Acceso y permisos' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Identidad de la junta' })).toBeNull();
    viewer.unmount();

    configureSession('admin');
    render(<App />);
    fireEvent.click((await navigation()).getByRole('button', { name: 'Configuración' }));
    expect(await screen.findByRole('link', { name: 'Acceso y permisos' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Identidad de la junta' })).toBeTruthy();
  });

  it('loads and accepts another organization’s terms before switching context', async () => {
    configureSession('admin');
    const destination = {
      ...activePrincipal.organization,
      id: 'organization-2',
      code: 'junta-dos',
      name: 'Junta destino',
      terms: { id: 'terms-destination', version: 2, body: 'Términos de destino suficientemente largos.', body_en: 'Destination terms are long enough.' },
    };
    apiMock.mockImplementation(async (path: string, method?: string, body?: unknown) => {
      if (path === 'me') return activePrincipal as never;
      if (path === 'folder-access') return { can_read: false } as never;
      if (path === 'planilla-settings') return { logo_data: null } as never;
      if (path === 'organizations/junta-dos') return destination as never;
      if (path === 'auth/switchOrganization' && method === 'POST') {
        activePrincipal = { ...activePrincipal, organization: destination };
        return {} as never;
      }
      throw new Error(`Unexpected API request: ${method ?? 'GET'} ${path}`);
    });
    render(<App />);

    fireEvent.click((await navigation()).getByRole('button', { name: 'Configuración' }));
    await screen.findByRole('heading', { name: 'Cambiar de junta' });
    fireEvent.change(screen.getByLabelText('Código de la junta'), { target: { value: 'junta-dos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar términos' }));

    const terms = await screen.findByRole('dialog', { name: 'Términos de Junta destino' });
    expect(within(terms).getByText('Términos de destino suficientemente largos.')).toBeTruthy();
    fireEvent.click(within(terms).getByRole('button', { name: 'Aceptar y cambiar de junta' }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('auth/switchOrganization', 'POST', {
      organization_code: 'junta-dos',
      terms_version_id: 'terms-destination',
      accepted: true,
    }));
    expect(await screen.findByText('Junta destino')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Términos de Junta destino' })).toBeNull();
  });

  it('surfaces profile-save errors and releases the busy state', async () => {
    configureSession('registrar');
    apiMock.mockImplementation(async (path: string, method?: string) => {
      if (path === 'me') return activePrincipal as never;
      if (path === 'folder-access') return { can_read: false } as never;
      if (path === 'planilla-settings') return { logo_data: null } as never;
      if (path === 'profile' && method === 'PATCH') throw new Error('El perfil no pudo guardarse.');
      throw new Error(`Unexpected API request: ${method ?? 'GET'} ${path}`);
    });
    render(<App />);

    fireEvent.click((await navigation()).getByRole('button', { name: 'Configuración' }));
    await screen.findByRole('heading', { name: 'Mi perfil' });
    const profile = document.getElementById('settings-profile')!;
    fireEvent.submit(within(profile).getByRole('button', { name: 'Guardar perfil' }).closest('form')!);

    expect((await screen.findByRole('alert')).textContent).toContain('El perfil no pudo guardarse.');
    expect((within(profile).getByRole('button', { name: 'Guardar perfil' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
