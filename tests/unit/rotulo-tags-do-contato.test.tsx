import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CRMSidePanel } from "@/components/inbox/CRMSidePanel";

/**
 * O painel do Inbox tinha dois lugares de etiqueta — o botão "Tags do contato" e a seção "Tags da
 * conversa" —, e quem atende não sabia em qual estava mexendo (#852, item 4). No fork os dois viraram
 * UM: a seção "Etiquetas", que mostra a união do contato e da conversa e grava nos dois. O botão
 * ambíguo não existe mais; esta suíte vigia que ele não volte e que as etiquetas do contato sigam na tela.
 */

const CONTACT = "c0000000-0000-4000-8000-000000000001";

const conversation = {
  id: "cv-1",
  organization_id: "org-1",
  contact_id: CONTACT,
  tags: [],
  contacts: { id: CONTACT, display_name: "Fulana", name: null, phone_number: "5511999", tags: ["cliente"] },
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

describe("painel do inbox — uma lista só de etiquetas (fork)", () => {
  function montar() {
    return render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CRMSidePanel conversation={conversation} />
      </QueryClientProvider>,
    );
  }

  it("não há mais o botão 'Tags do contato' nem um 'Tag' solto", async () => {
    montar();
    expect(await screen.findByRole("heading", { name: "Etiquetas" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tags do contato" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tag" })).toBeNull();
  });

  it("a seção 'Etiquetas' mostra as etiquetas do contato (a união com as da conversa)", async () => {
    montar();
    await screen.findByRole("heading", { name: "Etiquetas" });
    expect(screen.getByText("cliente")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Tags da conversa" })).toBeNull();
  });
});
