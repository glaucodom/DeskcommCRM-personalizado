/**
 * Fork #20 — B2C no painel lateral do Inbox e no diálogo "Novo Lead".
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DadosDaPessoaDoContato } from "@/components/inbox/DadosDaPessoaDoContato";
import { NewLeadDialog } from "@/components/kanban/NewLeadDialog";

const tipoMock = vi.hoisted(() => ({ pessoas: true }));
const patch = vi.hoisted(() => vi.fn(async () => ({ data: {} })));
vi.mock("@/hooks/contacts/useTipoDeCliente", () => ({
  useTipoDeCliente: () => ({ tipo: tipoMock.pessoas ? "pessoas" : "empresas", pessoas: tipoMock.pessoas }),
  recarregarTipoDeCliente: vi.fn(),
}));
vi.mock("@/hooks/auth/AuthProvider", () => ({ useActiveOrg: () => ({ currency: "BRL", country: null }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));
vi.mock("@/lib/api/client", () => ({
  apiClient: { patch, get: vi.fn(), post: vi.fn(async () => ({ data: { id: "l1" } })) },
}));
vi.mock("@/components/kanban/SeletorDeContato", () => ({ SeletorDeContato: () => null }));
vi.mock("@/hooks/kanban/useCreateLead", () => ({
  useCreateLead: () => ({ mutateAsync: vi.fn(async () => ({ data: { id: "l1" } })), isPending: false }),
}));

const CAMPO = [{ key: "renda", label: "Renda mensal", type: "text" as const, escopo: "contato" as const }];

function envolver(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  tipoMock.pessoas = true;
  patch.mockClear();
});

describe("DadosDaPessoaDoContato (painel do Inbox)", () => {
  it("mostra CPF, nascimento e o campo personalizado do contato", () => {
    envolver(
      <DadosDaPessoaDoContato
        contactId="c1"
        birthdate="1990-05-10"
        cpfCadastrado
        camposDoContato={CAMPO}
        customFields={{ renda: "5 mil" }}
      />,
    );
    expect(screen.getByLabelText("CPF")).toBeTruthy();
    expect((screen.getByLabelText("Data de nascimento") as HTMLInputElement).value).toBe("1990-05-10");
    expect(screen.getByText("Renda mensal")).toBeTruthy();
    expect((screen.getByLabelText("CPF") as HTMLInputElement).placeholder).toContain("Já cadastrado");
  });

  it("salva só o que mudou e junta os campos existentes", async () => {
    envolver(
      <DadosDaPessoaDoContato
        contactId="c1"
        birthdate={null}
        cpfCadastrado={false}
        camposDoContato={CAMPO}
        customFields={{ renda: "5 mil", outro: "x" }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Data de nascimento"), { target: { value: "1990-05-10" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar dados da pessoa/ }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [url, corpo] = patch.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe("/api/v1/contacts/c1");
    expect(corpo.birthdate).toBe("1990-05-10");
    expect(corpo.cpf).toBeUndefined();
    expect(corpo.custom_fields).toEqual({ renda: "5 mil", outro: "x" });
  });
});

describe("NewLeadDialog em B2C", () => {
  const base = { open: true, onOpenChange: vi.fn(), pipelineId: "p1", stages: [] };

  it("com contato conhecido mostra CPF, nascimento e campos do contato", () => {
    envolver(<NewLeadDialog {...base} contactId="c1" camposDoContato={CAMPO} dadosDaPessoa={{ birthdate: null, cpfCadastrado: false, custom_fields: {} }} />);
    expect(screen.getByLabelText("CPF")).toBeTruthy();
    expect(screen.getByLabelText("Data de nascimento")).toBeTruthy();
    expect(screen.getByText("Renda mensal")).toBeTruthy();
  });

  it("sem contato explica que é preciso escolher ou criar", () => {
    envolver(<NewLeadDialog {...base} />);
    expect(screen.queryByLabelText("CPF")).toBeNull();
    expect(screen.getByText(/Escolha ou crie o contato/)).toBeTruthy();
  });

  it("em B2B não aparece nada de CPF", () => {
    tipoMock.pessoas = false;
    envolver(<NewLeadDialog {...base} contactId="c1" dadosDaEmpresa={{}} />);
    expect(screen.queryByLabelText("CPF")).toBeNull();
    expect(screen.queryByText(/Escolha ou crie o contato/)).toBeNull();
  });
});
