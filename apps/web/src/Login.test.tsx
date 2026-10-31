import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {api, type Organization, type Principal} from "./api";
import {Login} from "./Login";

vi.mock("./api", async importOriginal => {
  const actual = await importOriginal<typeof import("./api")>();
  return {...actual, api: vi.fn()};
});

const apiMock = vi.mocked(api);
const organization = {
  id: "org-1",
  code: "junta-prueba",
  name: "Junta de prueba",
  terms: {id: "terms-1", version: 3, body: "Términos actuales"},
} as Organization;
const principal = {
  role: "admin",
  organization,
  user: {name: "Ana", email: "ana@example.test"},
} as Principal;

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function(this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function(this: HTMLDialogElement) { this.open = false; },
  });
  apiMock.mockReset();
  history.replaceState(null, "", "/j/" + organization.code + "/login");
});

afterEach(() => {
  cleanup();
  history.replaceState(null, "", "/");
});

async function loadOrganization(onLogin = vi.fn()) {
  apiMock.mockResolvedValueOnce(organization);
  render(<Login onLogin={onLogin} />);
  await screen.findByText(organization.name);
  return onLogin;
}

function acceptTerms() {
  fireEvent.click(screen.getByRole("checkbox"));
}

async function beginLogin() {
  await loadOrganization();
  acceptTerms();
  fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
    target: {value: "ana@example.test"},
  });
  fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
    target: {value: "example-password"},
  });
}

describe("Login", () => {
  it("looks up a council code entered on the access screen", async () => {
    history.replaceState(null, "", "/");
    apiMock.mockResolvedValueOnce(organization);
    render(<Login onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/código de la junta/i), {
      target: {value: organization.code},
    });
    fireEvent.click(screen.getByRole("button", {name: "Continuar"}));

    await screen.findByText(organization.name);
    expect(apiMock).toHaveBeenCalledWith("organizations/" + organization.code);
    expect(location.pathname).toBe("/j/" + organization.code + "/login");
  });

  it("requires accepted terms, then verifies the email challenge", async () => {
    const onLogin = vi.fn();
    await loadOrganization(onLogin);
    const submit = screen.getByRole("button", {name: "Ingresar"}) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", {name: /términos y condiciones/i}));
    fireEvent.click(screen.getByRole("button", {name: /aceptar términos/i}));
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: {value: "ana@example.test"},
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: {value: "example-password"},
    });

    apiMock.mockResolvedValueOnce({challenge_id: "challenge-1", resend_after: 0});
    fireEvent.click(submit);
    await screen.findByLabelText(/código de verificación/i);
    expect(apiMock).toHaveBeenLastCalledWith("auth/login", "POST", expect.objectContaining({
      email: "ana@example.test",
      password: "example-password",
      organization_code: organization.code,
      accepted: true,
      terms_version_id: organization.terms.id,
    }));

    apiMock.mockResolvedValueOnce(principal);
    fireEvent.change(screen.getByLabelText(/código de verificación/i), {
      target: {value: "123456"},
    });
    fireEvent.click(screen.getByRole("button", {name: /confirmar código/i}));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(principal));
    expect(apiMock).toHaveBeenLastCalledWith("auth/verify", "POST", {
      challenge_id: "challenge-1",
      code: "123456",
    });
  });

  it("sends a recovery request and shows the neutral confirmation", async () => {
    await loadOrganization();
    fireEvent.click(screen.getByRole("button", {name: /olvidé mi contraseña/i}));
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: {value: "ana@example.test"},
    });
    apiMock.mockResolvedValueOnce({message: "ok"});
    fireEvent.click(screen.getByRole("button", {name: /enviar instrucciones/i}));

    const notice = await screen.findByRole("status");
    expect(notice.textContent).toContain(
      "Si la cuenta está habilitada, recibirás instrucciones para recuperar el acceso.",
    );
    expect(apiMock).toHaveBeenLastCalledWith("auth/recover", "POST", {
      email: "ana@example.test",
      organization_code: organization.code,
    });
  });

  it("allows resending the challenge and cancelling it to return to login", async () => {
    await loadOrganization();
    acceptTerms();
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: {value: "ana@example.test"},
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: {value: "example-password"},
    });
    apiMock.mockResolvedValueOnce({challenge_id: "challenge-1", resend_after: 0});
    fireEvent.click(screen.getByRole("button", {name: "Ingresar"}));
    await screen.findByLabelText(/código de verificación/i);

    apiMock.mockResolvedValueOnce({challenge_id: "challenge-2", resend_after: 0});
    fireEvent.click(screen.getByRole("button", {name: /reenviar código/i}));
    await screen.findByRole("status");
    expect(apiMock).toHaveBeenLastCalledWith("auth/resend", "POST", {
      challenge_id: "challenge-1",
    });

    apiMock.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", {name: /volver al inicio de sesión/i}));
    await waitFor(() => expect(screen.getByLabelText(/^contraseña$/i)).toBeTruthy());
    expect(apiMock).toHaveBeenLastCalledWith("auth/cancel", "POST", {
      challenge_id: "challenge-2",
    });
  });

  it("renders login failures inside the application", async () => {
    await beginLogin();
    apiMock.mockRejectedValueOnce(new Error("El acceso fue rechazado."));
    fireEvent.click(screen.getByRole("button", {name: "Ingresar"}));

    expect((await screen.findByRole("alert")).textContent).toContain("El acceso fue rechazado.");
  });
});