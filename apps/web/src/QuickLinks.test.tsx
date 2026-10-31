import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, canAdmin, type Principal } from './api';
import { setLanguage } from './i18n';
import { QuickLinkSettings, QuickLinks } from './QuickLinks';

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    api: vi.fn(),
    canAdmin: vi.fn(),
  };
});

const catalog = [
  { function: 'register', label: 'Registro', label_en: 'Register' },
  { function: 'list', label: 'Lista', label_en: 'List' },
  { function: 'settings', label: 'Configuración', label_en: 'Settings' },
];

function configuration(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'common',
    common_version: 7,
    personal_version: 3,
    inherited: false,
    items: [catalog[0]],
    personal_items: null,
    common_items: [],
    catalog,
    ...overrides,
  };
}

function principal(role: string): Principal {
  return { role } as Principal;
}

const apiMock = vi.mocked(api);
const canAdminMock = vi.mocked(canAdmin);

beforeEach(() => {
  apiMock.mockReset();
  canAdminMock.mockReset();
  setLanguage('es');
});

afterEach(() => {
  cleanup();
  setLanguage('es');
});

describe('QuickLinks', () => {
  it('shows loading, renders supported shortcuts and navigates when one is selected', async () => {
    let resolveConfiguration!: (value: unknown) => void;
    apiMock.mockReturnValueOnce(new Promise(resolve => { resolveConfiguration = resolve; }) as never);
    const navigate = vi.fn();

    render(<QuickLinks navigate={navigate} />);

    expect(screen.getByRole('status').textContent).toContain('Cargando información');
    resolveConfiguration(configuration({
      items: [
        catalog[0],
        { function: 'not-in-menu', label: 'No debe mostrarse', label_en: 'Must not show' },
      ],
    }));

    const shortcut = await screen.findByRole('button', { name: 'Registro' });
    fireEvent.click(shortcut);

    expect(apiMock).toHaveBeenCalledWith('quick-links');
    expect(navigate).toHaveBeenCalledWith('register');
    expect(screen.queryByText('No debe mostrarse')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('uses the saved English label when the user language is English', async () => {
    setLanguage('en', 'test-user');
    apiMock.mockResolvedValueOnce(configuration({ items: [catalog[0]] }) as never);

    render(<QuickLinks navigate={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Register' })).toBeTruthy();
  });

  it('lets a superadmin update the organization shortcuts and policy', async () => {
    const initial = configuration({ mode: 'common', common_items: [] });
    apiMock
      .mockResolvedValueOnce(initial as never)
      .mockResolvedValueOnce(configuration({ mode: 'personal', common_items: [catalog[1]] }) as never);
    canAdminMock.mockReturnValue(true);

    render(<QuickLinkSettings principal={principal('superadmin')} />);

    fireEvent.change(await screen.findByLabelText('Modo de accesos rápidos'), { target: { value: 'personal' } });
    fireEvent.change(screen.getByLabelText('Común · Función 1'), { target: { value: 'list' } });
    fireEvent.change(screen.getByLabelText('Común · Etiqueta 1'), { target: { value: 'Atajos' } });
    fireEvent.change(screen.getByLabelText('Común · Etiqueta en inglés 1'), { target: { value: 'Shortcuts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar accesos de la junta' }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
    expect(apiMock).toHaveBeenNthCalledWith(2, 'quick-links/organization', 'PATCH', expect.objectContaining({
      version: 7,
      mode: 'personal',
      items: [expect.objectContaining({ function: 'list', label: 'Atajos', label_en: 'Shortcuts' })],
    }));
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Accesos rápidos guardados. Los verás al volver a Home.');
  });

  it('saves personal shortcuts with inheritance and version information', async () => {
    const initial = configuration({
      mode: 'personal',
      inherited: true,
      personal_items: null,
      items: [catalog[0]],
    });
    apiMock
      .mockResolvedValueOnce(initial as never)
      .mockResolvedValueOnce(configuration({ mode: 'personal', inherited: false, personal_items: [catalog[0]] }) as never);
    canAdminMock.mockReturnValue(false);

    render(<QuickLinkSettings principal={principal('viewer')} />);

    const inherit = await screen.findByRole('checkbox', { name: 'Usar los accesos de la junta' });
    expect((inherit as HTMLInputElement).checked).toBe(true);
    fireEvent.click(inherit);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mis accesos' }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
    expect(apiMock).toHaveBeenNthCalledWith(2, 'quick-links/personal', 'PATCH', {
      items: [catalog[0]],
      version: 3,
      inherit: false,
      common_version: 7,
    });
    expect(await screen.findByText('Accesos rápidos guardados. Los verás al volver a Home.')).toBeTruthy();
  });

  it('shows a load error and lets the user retry the request', async () => {
    apiMock
      .mockRejectedValueOnce(new Error('No se pudo cargar la configuración.'))
      .mockResolvedValueOnce(configuration() as never);
    canAdminMock.mockReturnValue(false);

    render(<QuickLinkSettings principal={principal('viewer')} />);

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo cargar la configuración.');
    fireEvent.click(screen.getByRole('button', { name: 'Recargar accesos' }));

    expect(await screen.findByRole('heading', { name: 'Accesos rápidos del panel' })).toBeTruthy();
    expect(apiMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a save error without using a browser alert', async () => {
    apiMock
      .mockResolvedValueOnce(configuration({ mode: 'personal', inherited: true, personal_items: null }) as never)
      .mockRejectedValueOnce(new Error('No se pudo guardar el cambio.'));
    canAdminMock.mockReturnValue(false);
    const browserAlert = vi.spyOn(window, 'alert');

    render(<QuickLinkSettings principal={principal('viewer')} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar mis accesos' }));

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo guardar el cambio.');
    expect(browserAlert).not.toHaveBeenCalled();
  });
});
