import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type Principal } from "./api";
import { setLanguage } from "./i18n";
import { PersonForm } from "./PersonForm";
import type { Person } from "./personTypes";

vi.mock("./api", async importOriginal => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, api: vi.fn() };
});

const apiMock = vi.mocked(api);
const principal = {
  role: "admin",
  organization: { id: "org-1", code: "junta-prueba", name: "Junta de prueba" },
} as Principal;
const schema = { version: 4, fields: [] };
const positions = { version: 2, items: [] };

beforeEach(() => {
  apiMock.mockReset();
  setLanguage("es");
});

afterEach(() => {
  cleanup();
  setLanguage("es");
});

function loadFormApi() {
  apiMock
    .mockResolvedValueOnce(schema as never)
    .mockResolvedValueOnce(positions as never);
}

describe("PersonForm", () => {
  it("loads its configuration and creates a pending person with versioned metadata", async () => {
    loadFormApi();
    apiMock.mockResolvedValueOnce({ id: "person-1" } as never);
    const onSaved = vi.fn();
    render(<PersonForm principal={principal} onSaved={onSaved} onBack={vi.fn()} />);

    await screen.findByRole("heading", { name: "Nuevo registro" });
    fireEvent.change(screen.getByLabelText(/^Tipo de documento/), { target: { value: "CC" } });
    fireEvent.change(screen.getByLabelText(/^Número de documento/), { target: { value: "123456789" } });
    fireEvent.change(screen.getByLabelText(/^Nombres/), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar registro" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(apiMock).toHaveBeenNthCalledWith(3, "persons", "POST", expect.objectContaining({
      document_type: "CC",
      document_number: "123456789",
      first_names: "Ana",
      schema_version: schema.version,
      positions_version: positions.version,
      custom_values: {},
    }));
  });

  it("updates an existing person using its optimistic version", async () => {
    loadFormApi();
    apiMock.mockResolvedValueOnce({ id: "person-1" } as never);
    const onSaved = vi.fn();
    const initial = {
      id: "person-1",
      first_names: "Ana",
      last_names: "Pérez",
      document_type: "CC",
      document_number: "123456789",
      status: "pending",
      version: 7,
    } as Person;
    render(<PersonForm principal={principal} initial={initial} onSaved={onSaved} onBack={vi.fn()} />);

    await screen.findByRole("heading", { name: "Editar persona" });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(apiMock).toHaveBeenNthCalledWith(3, "persons/person-1", "PATCH", expect.objectContaining({
      version: 7,
      schema_version: schema.version,
      positions_version: positions.version,
      first_names: "Ana",
      document_number: "123456789",
    }));
  });
});