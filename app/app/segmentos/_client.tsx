"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { recarregarSegmentos, useSegmentos } from "@/hooks/contacts/useSegmentos";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { roleAtLeast } from "@/lib/auth/types";
import { PencilSimple, Trash } from "@/lib/ui/icons";

/**
 * Fork #32: CRM › Segmentos. A lista de segmentos DESTA empresa (só B2B). Todo mundo da equipe vê;
 * gerente em diante cadastra, renomeia (muda também nos contatos) e tira da lista (os contatos
 * mantêm o que já têm).
 */
export function SegmentosClient() {
  const t = useT();
  const { user, activeOrg } = useAuth();
  const pode = (user.is_platform_admin && !user.support) || roleAtLeast(activeOrg?.role, "manager");
  const { data, isLoading, isError } = useSegmentos();
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState("");

  const recarregar = () => recarregarSegmentos();
  const falha = () => toast.error(t("Não foi possível salvar. Confira se o nome já existe."));

  const criar = useMutation({
    mutationFn: (nome: string) => apiClient.post("/api/v1/segmentos", { nome }),
    onSuccess: () => { setNovo(""); recarregar(); },
    onError: falha,
  });
  const renomear = useMutation({
    mutationFn: (p: { de: string; para: string }) => apiClient.patch("/api/v1/segmentos", p),
    onSuccess: () => { setEditando(null); recarregar(); },
    onError: falha,
  });
  const tirar = useMutation({
    mutationFn: (nome: string) => apiClient.delete(`/api/v1/segmentos?nome=${encodeURIComponent(nome)}`),
    onSuccess: recarregar,
    onError: falha,
  });

  const lista = data?.data ?? [];
  return (
    <div className="w-full space-y-4">
      <header>
        <h1 className="text-lg font-semibold">{t("Segmentos")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Os segmentos desta empresa. Eles aparecem para escolher no contato, no Inbox e no Novo lead.")}
        </p>
      </header>

      {pode && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (novo.trim()) criar.mutate(novo);
          }}
        >
          <Input value={novo} maxLength={80} placeholder={t("Novo segmento")} onChange={(e) => setNovo(e.target.value)} aria-label={t("Novo segmento")} />
          <Button type="submit" disabled={criar.isPending || !novo.trim()}>{t("Adicionar")}</Button>
        </form>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">{t("Carregando segmentos…")}</p>}
      {isError && <p role="alert" className="text-sm text-destructive">{t("Não foi possível ler os segmentos.")}</p>}
      {!isLoading && !isError && lista.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("Nenhum segmento cadastrado ainda.")}</p>
      )}

      <ul className="divide-y rounded-md border">
        {lista.map((s) => (
          <li key={s.nome} className="flex items-center gap-2 px-3 py-2 text-sm">
            {editando === s.nome ? (
              <>
                <Input
                  autoFocus
                  value={valor}
                  maxLength={80}
                  className="h-8"
                  aria-label={t("Nome do segmento")}
                  onChange={(e) => setValor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && valor.trim()) renomear.mutate({ de: s.nome, para: valor });
                    if (e.key === "Escape") setEditando(null);
                  }}
                />
                <Button size="sm" disabled={renomear.isPending || !valor.trim()} onClick={() => renomear.mutate({ de: s.nome, para: valor })}>{t("Salvar")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>{t("Cancelar")}</Button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate">{s.nome}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{s.usos} {t("contatos")}</span>
                {pode && (
                  <>
                    <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label={t("Renomear")} title={t("Renomear")} onClick={() => { setEditando(s.nome); setValor(s.nome); }}>
                      <PencilSimple className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      aria-label={t("Tirar da lista")}
                      title={t("Tirar da lista")}
                      onClick={() => {
                        if (window.confirm(t("Tirar este segmento da lista? Os contatos que já o têm continuam com ele."))) tirar.mutate(s.nome);
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {renomear.isPending && <p className="text-xs text-muted-foreground">{t("Atualizando os contatos…")}</p>}
    </div>
  );
}
