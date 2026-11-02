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
vi.mock('./ui', () => ({ ErrorBox: () => null, Loading: () => null, Modal: () => null }));
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
