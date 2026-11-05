import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api';
import { App } from './App';
import { setLanguage } from './i18n';

vi.mock('./api', async importOriginal => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, api: vi.fn() };
});

vi.mock('./Login', () => ({ Login: () => <main data-testid="login-screen" /> }));
vi.mock('./Memberships', async importOriginal => {
  const actual = await importOriginal<typeof import('./Memberships')>();
  return { ...actual, InvitationAcceptance: () => <main data-testid="invitation-screen" /> };
});

const apiMock = vi.mocked(api);

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

describe('application entry routing', () => {
  it('shows login after the session endpoint reports an unauthenticated visitor', async () => {
    apiMock.mockRejectedValue(new ApiError(401, 'Unauthenticated'));

    render(<App />);

    expect(await screen.findByTestId('login-screen')).toBeTruthy();
    expect(apiMock).toHaveBeenCalledExactlyOnceWith('me');
  });

  it('opens invitation acceptance without making an authenticated session request', () => {
    window.history.replaceState({}, '', '/invite');

    render(<App />);

    expect(screen.getByTestId('invitation-screen')).toBeTruthy();
    expect(apiMock).not.toHaveBeenCalled();
  });
});
