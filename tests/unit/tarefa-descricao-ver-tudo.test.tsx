import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ListaDeTarefas } from "@/app/app/tasks/_components/ListaDeTarefas";
import { descricaoPedeVerTudo } from "@/lib/personalizacoes/descricao-da-tarefa";
import type { Tarefa } from "@/lib/tarefas/tipos";

/**
 * Descrição longa da tarefa: a lista a corta em uma linha, e quem escreveu um
 * texto comprido não tinha como lê-lo sem abrir a edição. Agora a linha traz
 * "Ver tudo" quando o texto passa do limite, e "Ver menos" para recolher.
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

const TEXTO_LONGO = `${"Ative o cache de prompt no prompt de sistema. ".repeat(6)}FIM-DO-TEXTO`;

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

function lista(t: Tarefa) {
  return render(
    <ListaDeTarefas
      tarefas={[t]}
      podeEditar={false}
      aoAlternarConcluida={vi.fn(async () => ({}))}
      aoEditar={vi.fn()}
      aoApagar={vi.fn(async () => ({}))}
      mostrarNegocio={false}
    />,
  );
}

describe("descricaoPedeVerTudo", () => {
  it("texto curto de uma linha não pede o botão", () => {
    expect(descricaoPedeVerTudo("Confirmar a entrega")).toBe(false);
  });

  it("texto comprido pede o botão", () => {
    expect(descricaoPedeVerTudo(TEXTO_LONGO)).toBe(true);
  });

  it("texto com quebra de linha pede o botão, mesmo curto", () => {
    expect(descricaoPedeVerTudo("linha 1\nlinha 2")).toBe(true);
  });

  it("vazio ou nulo nunca pede", () => {
    expect(descricaoPedeVerTudo(null)).toBe(false);
    expect(descricaoPedeVerTudo("   ")).toBe(false);
  });
});

describe("descrição da tarefa na lista", () => {
  it("descrição curta não mostra o botão", () => {
    lista(tarefa({ description: "Confirmar a entrega" }));
    expect(screen.queryByRole("button", { name: "Ver tudo" })).toBeNull();
  });

  it("sem descrição não mostra o botão", () => {
    lista(tarefa());
    expect(screen.queryByRole("button", { name: "Ver tudo" })).toBeNull();
  });

  it("descrição longa começa recolhida, com o botão Ver tudo", () => {
    lista(tarefa({ description: TEXTO_LONGO }));
    const botao = screen.getByRole("button", { name: "Ver tudo" });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText(TEXTO_LONGO).className).toContain("truncate");
  });

  it("Ver tudo mostra o texto inteiro e vira Ver menos; Ver menos recolhe", async () => {
    const u = userEvent.setup();
    lista(tarefa({ description: TEXTO_LONGO }));

    await u.click(screen.getByRole("button", { name: "Ver tudo" }));
    const aberto = screen.getByText(TEXTO_LONGO);
    expect(aberto.className).not.toContain("truncate");
    expect(aberto.className).toContain("whitespace-pre-wrap");
    const menos = screen.getByRole("button", { name: "Ver menos" });
    expect(menos.getAttribute("aria-expanded")).toBe("true");

    await u.click(menos);
    expect(screen.getByText(TEXTO_LONGO).className).toContain("truncate");
    expect(screen.getByRole("button", { name: "Ver tudo" })).toBeTruthy();
  });

  it("o botão não marca nem abre a tarefa (só alterna o texto)", async () => {
    const u = userEvent.setup();
    const aoAlternarConcluida = vi.fn(async () => ({}));
    render(
      <ListaDeTarefas
        tarefas={[tarefa({ description: TEXTO_LONGO })]}
        podeEditar
        aoAlternarConcluida={aoAlternarConcluida}
        aoEditar={vi.fn()}
        aoApagar={vi.fn(async () => ({}))}
        mostrarNegocio={false}
      />,
    );
    await u.click(screen.getByRole("button", { name: "Ver tudo" }));
    expect(aoAlternarConcluida).not.toHaveBeenCalled();
  });
});
