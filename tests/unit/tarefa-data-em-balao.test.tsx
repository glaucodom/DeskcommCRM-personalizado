import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListaDeTarefas } from "@/app/app/tasks/_components/ListaDeTarefas";
import type { Tarefa } from "@/lib/tarefas/tipos";

/**
 * Data e hora do prazo dentro de um balão (pílula), no estilo da etiqueta de
 * prioridade: arredondado, com o ícone de calendário, e a cor conta a situação —
 * atrasada em vermelho do tema, no prazo neutra, sem prazo tracejada.
 */

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (texto: string) => texto }));
vi.mock("@/hooks/i18n/useLocaleDeData", () => ({ useTagDeIdioma: () => "pt-BR" }));
vi.mock("@/hooks/auth/AuthProvider", () => ({ useUser: () => ({ id: "u-eu" }) }));
vi.mock("@/hooks/inbox/useAssignableMembers", () => ({
  useAssignableMembers: () => ({ isSuccess: true, data: [] }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...resto }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

const UM_DIA = 24 * 60 * 60 * 1000;

function tarefa(resto: Partial<Tarefa> = {}): Tarefa {
  return {
    id: "t-1",
    organization_id: "org-1",
    title: "Ligar para minha rainha",
    description: null,
    due_date: null,
    priority: "medium",
    status: "pending",
    lead_id: null,
    contact_id: null,
    demanda_id: null,
    assigned_to: null,
    created_by: null,
    created_at: "2026-10-23T12:00:00Z",
    updated_at: "2026-10-23T12:00:00Z",
    ...resto,
  };
}

function prazoDe(t: Tarefa): HTMLElement {
  const { container } = render(
    <ListaDeTarefas
      tarefas={[t]}
      podeEditar={false}
      aoAlternarConcluida={vi.fn(async () => ({}))}
      aoEditar={vi.fn()}
      aoApagar={vi.fn(async () => ({}))}
      mostrarNegocio={false}
    />,
  );
  const balao = container.querySelector<HTMLElement>("[data-prazo]");
  if (!balao) throw new Error("balão do prazo não encontrado");
  return balao;
}

describe("prazo da tarefa em balão", () => {
  it("é uma pílula arredondada com o ícone de calendário", () => {
    const balao = prazoDe(tarefa({ due_date: new Date(Date.now() + 3 * UM_DIA).toISOString() }));
    expect(balao.className).toContain("rounded-full");
    expect(balao.className).toContain("border");
    expect(balao.querySelector("svg")).not.toBeNull();
  });

  it("no prazo: neutro, sem vermelho", () => {
    const balao = prazoDe(tarefa({ due_date: new Date(Date.now() + 3 * UM_DIA).toISOString() }));
    expect(balao.getAttribute("data-prazo")).toBe("no_prazo");
    expect(balao.className).not.toContain("destructive");
  });

  it("atrasada: balão no vermelho do tema", () => {
    const balao = prazoDe(tarefa({ due_date: new Date(Date.now() - 2 * UM_DIA).toISOString() }));
    expect(balao.getAttribute("data-prazo")).toBe("atrasada");
    expect(balao.className).toContain("text-destructive");
    expect(balao.className).toContain("bg-destructive/10");
  });

  it("sem prazo: balão tracejado com o texto Sem prazo", () => {
    const balao = prazoDe(tarefa({ due_date: null }));
    expect(balao.getAttribute("data-prazo")).toBe("sem_prazo");
    expect(balao.className).toContain("border-dashed");
    expect(balao.textContent).toContain("Sem prazo");
  });

  it("tarefa concluída com prazo vencido não fica vermelha", () => {
    const balao = prazoDe(
      tarefa({ due_date: new Date(Date.now() - 2 * UM_DIA).toISOString(), status: "done" }),
    );
    expect(balao.getAttribute("data-prazo")).toBe("no_prazo");
  });
});
