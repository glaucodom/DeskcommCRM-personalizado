import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationTagsEditor } from "@/components/inbox/ConversationTagsEditor";

/**
 * UMA lista de etiquetas para a conversa e o contato (fork).
 *
 * No Inbox havia duas listas — "Tags do contato" e "Tags da conversa" — e cada
 * contato tem uma conversa por número, então na prática eram a mesma coisa duas
 * vezes. Com `contactId`, o editor da conversa passa a mostrar a UNIÃO das duas e
 * a gravar nas DUAS caixas: as regras que leem `contacts.tags` (a etiqueta
 * `cliente` que leva à Clara 2, a lista de contato interno) continuam enxergando
 * o que o operador marcou. Sem `contactId` o editor é o de sempre.
 */

const conversa = vi.hoisted(() => ({ mutate: vi.fn() }));
const contato = vi.hoisted(() => ({ mutate: vi.fn(), idRecebido: [] as string[] }));

vi.mock("@/hooks/auth/AuthProvider", () => ({ useAuth: () => ({ activeOrg: { role: "agent" } }) }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/inbox/useConversationTags", () => ({
  useUpdateConversationTags: () => ({ mutate: conversa.mutate, isPending: false }),
  useConversationTagVocabulary: () => ({ data: [] }),
}));
vi.mock("@/hooks/contacts/useUpdateContact", () => ({
  useUpdateContact: (id: string) => {
    contato.idRecebido.push(id);
    return { mutate: contato.mutate, isPending: false };
  },
}));
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn().mockResolvedValue({}), patch: vi.fn().mockResolvedValue({}) },
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function montar(props: { tags: string[]; contactId?: string | null; contactTags?: string[] }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConversationTagsEditor conversationId="c1" orgId="o1" {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  conversa.mutate.mockReset();
  contato.mutate.mockReset();
  contato.idRecebido.length = 0;
});
afterEach(() => cleanup());

describe("Etiquetas únicas — conversa + contato", () => {
  it("com contactId o título é Etiquetas; sem ele continua Tags da conversa", () => {
    montar({ tags: [], contactId: "p1", contactTags: [] });
    expect(screen.getByRole("heading", { name: "Etiquetas" })).toBeTruthy();
    cleanup();
    montar({ tags: [] });
    expect(screen.getByRole("heading", { name: "Tags da conversa" })).toBeTruthy();
  });

  it("mostra a união das etiquetas do contato e da conversa, sem repetir", () => {
    montar({ tags: ["urgente", "vip"], contactId: "p1", contactTags: ["cliente", "VIP"] });
    expect(screen.getByText("cliente")).toBeTruthy();
    expect(screen.getByText("urgente")).toBeTruthy();
    expect(screen.getAllByText(/^vip$/i)).toHaveLength(1);
  });

  it("adicionar grava a lista inteira nas duas caixas", async () => {
    const u = userEvent.setup();
    montar({ tags: ["urgente"], contactId: "p1", contactTags: ["cliente"] });
    await u.type(screen.getByLabelText("Adicionar tag à conversa"), "Recompra");
    await u.click(screen.getByRole("button", { name: "Adicionar tag" }));
    const esperado = ["cliente", "urgente", "recompra"];
    expect(conversa.mutate).toHaveBeenCalledWith({ conversation_id: "c1", tags: esperado });
    expect(contato.mutate).toHaveBeenCalledWith({ tags: esperado });
    expect(contato.idRecebido).toContain("p1");
  });

  it("remover tira das duas caixas, inclusive a que só o contato tinha", async () => {
    const u = userEvent.setup();
    montar({ tags: ["urgente"], contactId: "p1", contactTags: ["cliente"] });
    await u.click(screen.getByRole("button", { name: "Remover tag cliente" }));
    expect(conversa.mutate).toHaveBeenCalledWith({ conversation_id: "c1", tags: ["urgente"] });
    expect(contato.mutate).toHaveBeenCalledWith({ tags: ["urgente"] });
  });

  it("a etiqueta `cliente` marcada aqui chega em contacts.tags (a regra da Clara 2 a enxerga)", async () => {
    const u = userEvent.setup();
    montar({ tags: [], contactId: "p1", contactTags: [] });
    await u.type(screen.getByLabelText("Adicionar tag à conversa"), "cliente");
    await u.click(screen.getByRole("button", { name: "Adicionar tag" }));
    expect(contato.mutate).toHaveBeenCalledWith({ tags: ["cliente"] });
  });

  it("no teto de 20 etiquetas na união, não deixa adicionar", () => {
    const muitas = Array.from({ length: 12 }, (_, i) => `a${i}`);
    const outras = Array.from({ length: 12 }, (_, i) => `b${i}`);
    montar({ tags: outras, contactId: "p1", contactTags: muitas });
    expect(screen.getByLabelText("Adicionar tag à conversa")).toBeDisabled();
  });

  it("sem contactId nada é gravado no contato (comportamento de antes)", async () => {
    const u = userEvent.setup();
    montar({ tags: [] });
    await u.type(screen.getByLabelText("Adicionar tag à conversa"), "vip");
    await u.click(screen.getByRole("button", { name: "Adicionar tag" }));
    expect(conversa.mutate).toHaveBeenCalledWith({ conversation_id: "c1", tags: ["vip"] });
    expect(contato.mutate).not.toHaveBeenCalled();
  });
});
