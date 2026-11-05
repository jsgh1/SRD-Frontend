import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("web API client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the data envelope and keeps same-origin credentials for GET", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "p-1" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const { api } = await import("./api");

    await expect(api("people")).resolves.toEqual([{ id: "p-1" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/people", expect.objectContaining({
      method: "GET",
      credentials: "same-origin",
      headers: expect.objectContaining({ Accept: "application/json" }),
    }));
  });

  it("obtains CSRF before a write and sends the token with the JSON body", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { token: "csrf-test" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "p-2" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }));
    const { api } = await import("./api");

    await expect(api("people", "POST", { name: "Persona de prueba" })).resolves.toEqual({ id: "p-2" });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/csrf", expect.objectContaining({ credentials: "same-origin" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/people", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-test" }),
      body: JSON.stringify({ name: "Persona de prueba" }),
    }));
  });

  it("preserves structured validation details for an authorization failure", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { message: "No tienes permiso.", fields: { role: ["Acción restringida."] } },
    }), { status: 403, headers: { "Content-Type": "application/json" } }));
    const { api, ApiError } = await import("./api");

    const result = api("people");
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      status: 403,
      message: "No tienes permiso.",
      fields: { role: ["Acción restringida."] },
    });
  });

  it("discards the cached CSRF token after session expiry before the next write", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { token: "csrf-before-expiry" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "person-1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "La sesión venció." } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { token: "csrf-after-expiry" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { challenge_id: "challenge-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    const { api, ApiError } = await import("./api");

    await expect(api("persons", "POST", { first_names: "Persona sintética" })).resolves.toEqual({
      id: "person-1",
    });
    await expect(api("me")).rejects.toBeInstanceOf(ApiError);
    await expect(api("auth/login", "POST", { email: "test@example.test" })).resolves.toEqual({
      challenge_id: "challenge-1",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/csrf", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/v1/csrf", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(5, "/api/v1/auth/login", expect.objectContaining({
      headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-after-expiry" }),
    }));
  });

  it("reports a connection failure without claiming the request succeeded", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network unavailable"));
    const { api } = await import("./api");

    await expect(api("people")).rejects.toThrow("No hay conexión. La operación no se ha confirmado.");
  });
});

describe("web role capability guards", () => {
  it.each([
    ["superadmin", true, true],
    ["admin", true, true],
    ["registrar", true, false],
    ["treasurer", false, false],
    ["auditor", false, false],
    ["viewer", false, false],
    ["unknown", false, false],
  ])("maps %s to its configured write/admin capabilities", async (role, write, admin) => {
    const { canWrite, canAdmin } = await import("./api");
    expect(canWrite(String(role))).toBe(write);
    expect(canAdmin(String(role))).toBe(admin);
  });
});
