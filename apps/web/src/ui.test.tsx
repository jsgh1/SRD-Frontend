import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { setLanguage } from "./i18n";
import { Empty, ErrorBox, Loading } from "./ui";

afterEach(() => {
  cleanup();
  setLanguage("es");
});

describe("Empty state", () => {
  it("keeps the heading and guidance visible to assistive technology", () => {
    render(<Empty title="No hay personas">Registra la primera persona para comenzar.</Empty>);

    expect(screen.getByRole("heading", { name: "No hay personas" })).toBeTruthy();
    expect(screen.getByText("Registra la primera persona para comenzar.")).toBeTruthy();
  });

  it("supports a heading-only state without rendering empty guidance", () => {
    render(<Empty title="Sin resultados" />);

    expect(screen.getByRole("heading", { name: "Sin resultados" })).toBeTruthy();
    expect(document.querySelector(".empty p")?.textContent).toBe("");
  });

  it("renders API field errors as an accessible alert", () => {
    render(<ErrorBox error={new ApiError(422, "Revisa los datos.", { email: ["El correo no es válido."] })} />);

    expect(screen.getByRole("alert").textContent).toContain("Revisa los datos.");
    expect(screen.getByText("El correo no es válido.")).toBeTruthy();
  });

  it("renders a generic failure without exposing browser-native alerts", () => {
    render(<ErrorBox error={new Error("El servicio no respondió.")} />);

    expect(screen.getByRole("alert").textContent).toBe("El servicio no respondió.");
  });

  it("renders the shared loading status for assistive technology", () => {
    render(<Loading />);

    expect(screen.getByRole("status").textContent).toContain("Cargando información");
  });

  it("localizes fallback errors when the persistent language is English", () => {
    setLanguage("en", "test-user");
    render(<ErrorBox error={new ApiError(403, "Mensaje no traducido.")} />);

    expect(screen.getByRole("alert").textContent).toBe("You do not have permission to do this.");
  });
});
