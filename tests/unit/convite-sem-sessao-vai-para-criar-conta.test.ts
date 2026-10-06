import { describe, expect, it, vi } from "vitest";

/**
 * Quem abre o link do convite sem estar logado vai direto para "Criar conta",
 * com o convite no link. Antes parava numa tela com "Fazer login" em destaque,
 * e o convidado — que quase nunca tem conta — achava que precisava de uma.
 */

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  authRateLimited: async () => false,
  AUTH_LIMITS: { invite_accept: {} },
}));
vi.mock("@/lib/auth/invite-token", () => ({
  verifyInviteToken: () => ({ email: "novo@exemplo.com", role: "agent" }),
}));

describe("convite aberto sem sessão", () => {
  it("redireciona para /signup com o token do convite", async () => {
    const { default: Pagina } = await import("@/app/team/accept-invite/[token]/page");
    await expect(Pagina({ params: Promise.resolve({ token: "tok/123" }) })).rejects.toThrow(
      "REDIRECT:/signup?invite=tok%2F123",
    );
    expect(redirect).toHaveBeenCalledWith("/signup?invite=tok%2F123");
  });
});
