"use client";
import { useState } from "react";
import { useT } from "@/hooks/i18n/useT";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { Input } from "@/components/ui/input";
import { Check, PencilSimple, X } from "@/lib/ui/icons";
import { nomeProprio } from "@/lib/personalizacoes/nome-proprio";

/**
 * Fork #28: nome do contato no painel lateral do Inbox, com lápis para trocar na hora,
 * sem sair da conversa. Enter salva, Esc cancela; grava em `name` (o nome escolhido pela
 * equipe) já com a máscara de maiúsculas.
 */
export function NomeEditavelDoContato({
  contactId,
  rotulo,
  nomeSalvo,
}: {
  contactId: string;
  /** O que a tela mostra hoje (nome, apelido ou telefone). */
  rotulo: string;
  /** O que vale como ponto de partida na edição; vazio quando só há telefone. */
  nomeSalvo: string;
}) {
  const t = useT();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const salvar = useUpdateContact(contactId);

  const abrir = () => {
    setValor(nomeSalvo);
    setEditando(true);
  };
  const confirmar = () => {
    const nome = nomeProprio(valor);
    if (!nome) {
      setEditando(false);
      return;
    }
    if (nome === nomeSalvo) {
      setEditando(false);
      return;
    }
    salvar.mutate({ name: nome }, { onSuccess: () => setEditando(false) });
  };

  if (!editando) {
    return (
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1 truncate font-medium">{rotulo}</div>
        <button
          type="button"
          onClick={abrir}
          aria-label={t("Editar nome")}
          title={t("Editar nome")}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PencilSimple className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        value={valor}
        maxLength={200}
        disabled={salvar.isPending}
        aria-label={t("Nome")}
        className="h-7 text-sm"
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
          if (e.key === "Escape") setEditando(false);
        }}
      />
      <button type="button" onClick={confirmar} disabled={salvar.isPending} aria-label={t("Salvar")} title={t("Salvar")} className="shrink-0 rounded-md p-1 text-primary hover:bg-muted">
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setEditando(false)} aria-label={t("Cancelar")} title={t("Cancelar")} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
