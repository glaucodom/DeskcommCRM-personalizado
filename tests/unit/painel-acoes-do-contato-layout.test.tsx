import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CRMSidePanel } from "@/components/inbox/CRMSidePanel";

/**
 * Cartão do contato no painel do Inbox: "Marcar compromisso" fica sozinho na primeira linha, e
 * "Novo Lead" fica AO LADO de "Ver contato" na segunda. Antes o botão de lead dividia a linha com o
 * link e o "Ver contato" caía sozinho embaixo.
 */

const CONTACT = "c0000000-0000-4000-8000-000000000001";

const conversation = {
  id: "cv-1",
  organization_id: "org-1",
  contact_id: CONTACT,
  tags: [],
  contacts: { id: CONTACT, display_name: "Fulana", name: null, phone_number: "5511999", tags: [] },
} as unknown as React.ComponentProps<typeof CRMSidePanel>["conversation"];

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...args: unknown[]) => get(...args), post: vi.fn(), patch: vi.fn() },
}));
vi.mock("@/hooks/pipelines/useDefaultPipeline", () => ({
  useDefaultPipeline: () => ({ data: null, isError: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/inbox/useConversationTags", () => ({
  useUpdateConversationTags: () => ({ mutate: vi.fn(), isPending: false }),
  useConversationTagVocabulary: () => ({ data: [] }),
}));
vi.mock("@/hooks/contacts/useContactTagVocabulary", () => ({
  useContactTagVocabulary: () => ({ data: [] }),
}));
vi.mock("@/hooks/contacts/useUpdateContact", () => ({
  useUpdateContact: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/auth/AuthProvider", () => ({ useAuth: () => ({ user: { support: null } }) }));

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { leads: [], orders: [], activities: [], demandas: [], fatos: [], historico: [] } });
});

describe("painel do inbox — ações do cartão do contato", () => {
  async function montar() {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CRMSidePanel conversation={conversation} />
      </QueryClientProvider>,
    );
    const novoLead = await screen.findByRole("button", { name: /Novo Lead/ });
    const verContato = screen.getByRole("link", { name: /Ver contato/ });
    const compromisso = screen.getByRole("link", { name: "Marcar compromisso" });
    return { novoLead, verContato, compromisso };
  }

  it("Novo Lead e Ver contato ficam lado a lado, na mesma linha", async () => {
    const { novoLead, verContato } = await montar();
    const linhaDoLead = novoLead.parentElement;
    const linhaDoContato = verContato.closest("div");
    expect(linhaDoLead).toBe(linhaDoContato);
  });

  it("Marcar compromisso ocupa a linha de cima sozinho", async () => {
    const { compromisso, novoLead } = await montar();
    expect(compromisso.className).toContain("basis-full");
    // vem ANTES do Novo Lead na ordem do documento
    expect(compromisso.compareDocumentPosition(novoLead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a seção Etiquetas vem logo abaixo do cartão do contato, ANTES de Dados da empresa", async () => {
    await montar();
    const etiquetas = await screen.findByRole("heading", { name: "Etiquetas" });
    const empresa = await screen.findByRole("heading", { name: "Dados da empresa" });
    const contato = screen.getByRole("heading", { name: "Contato" });
    expect(contato.compareDocumentPosition(etiquetas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(etiquetas.compareDocumentPosition(empresa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
