"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { roleAtLeast } from "@/lib/auth/types";

interface Estado {
  fase: "analisando" | "pronto" | "importando" | "concluida" | "erro";
  conversas_total: number;
  conversas_feitas: number;
  mensagens_novas: number;
  mensagens_importadas: number;
  ja_existiam: number;
  grupos_ignorados: number;
  sem_telefone: number;
  midias_indisponiveis: number;
  contatos_novos: number;
  conversas_novas: number;
  erro?: string;
}

const numero = (n: number) => n.toLocaleString("pt-BR");

/**
 * Fork #30: "Importar histórico para o CRM" no cartão do número (só administrador, só com
 * "Guardar o histórico" ligado). Analisa → mostra a prévia → confirma → importa em segundo
 * plano com barra de progresso e resumo. Só histórico: nada aciona IA, automação ou rodízio.
 */
export function ImportarHistorico({ channelId }: { channelId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const { user, activeOrg } = useAuth();
  const podeImportar = (user.is_platform_admin && !user.support) || roleAtLeast(activeOrg?.role, "admin");
  const [aberto, setAberto] = useState(false);
  const chave = ["importar-historico", channelId];

  const query = useQuery({
    queryKey: chave,
    queryFn: () => apiClient.get<{ data: { estado: Estado | null } }>(`/api/v1/channel-sessions/${channelId}/importar-historico`),
    enabled: podeImportar,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => {
      const fase = q.state.data?.data.estado?.fase;
      return fase === "analisando" || fase === "importando" ? 2000 : false;
    },
  });
  const estado = query.data?.data.estado ?? null;

  const pedir = useMutation({
    mutationFn: (acao: "analisar" | "importar") =>
      apiClient.post(`/api/v1/channel-sessions/${channelId}/importar-historico`, { acao }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chave }),
    onError: () => toast.error(t("Não foi possível iniciar a importação agora.")),
  });

  if (!podeImportar) return null;

  const ocupado = estado?.fase === "analisando" || estado?.fase === "importando";
  const pct = estado && estado.conversas_total > 0 ? Math.round((estado.conversas_feitas / estado.conversas_total) * 100) : 0;

  return (
    <div className="mt-1 flex flex-col gap-1">
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pedir.isPending || ocupado}
          onClick={() => {
            setAberto(true);
            if (!ocupado) pedir.mutate("analisar");
          }}
        >
          {t("Importar histórico para o CRM")}
        </Button>
      </div>

      {estado?.fase === "importando" && !aberto && (
        <p className="text-[11px] text-muted-foreground">
          {t("Importando…")} {pct}% ({numero(estado.conversas_feitas)}/{numero(estado.conversas_total)})
        </p>
      )}
      {estado?.fase === "concluida" && !aberto && (
        <p className="text-[11px] text-muted-foreground">
          {t("Última importação")}: {numero(estado.mensagens_importadas)} {t("mensagens importadas")}.
        </p>
      )}

      <AlertDialog open={aberto} onOpenChange={setAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Importar histórico para o CRM")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {(!estado || estado.fase === "analisando") && (
                  <p>
                    {t("Analisando as conversas deste número…")} {estado ? `${numero(estado.conversas_feitas)}/${numero(estado.conversas_total)}` : ""}
                  </p>
                )}
                {estado?.fase === "pronto" && (
                  <>
                    <p>
                      {t("Vão entrar")} <strong>{numero(estado.mensagens_novas)}</strong> {t("mensagens novas de")}{" "}
                      <strong>{numero(estado.conversas_total - estado.sem_telefone)}</strong> {t("conversas.")}
                    </p>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">
                      <li>{numero(estado.ja_existiam)} {t("mensagens já estão no CRM e serão puladas.")}</li>
                      <li>{numero(estado.grupos_ignorados)} {t("grupos ficam de fora.")}</li>
                      {estado.sem_telefone > 0 && <li>{numero(estado.sem_telefone)} {t("conversas sem telefone identificado serão puladas.")}</li>}
                      <li>{numero(estado.midias_indisponiveis)} {t("mídias antigas entram sem o arquivo (indisponível).")}</li>
                    </ul>
                    <p className="text-xs">
                      {t("É só histórico: não dispara IA, automação nem fila. As conversas novas entram fechadas e reabrem sozinhas quando o cliente escrever. Pode repetir sem duplicar.")}
                    </p>
                  </>
                )}
                {estado?.fase === "importando" && (
                  <>
                    <p>{t("Importando em segundo plano. Pode fechar esta janela.")}</p>
                    <div className="h-2 w-full overflow-hidden rounded-md bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {numero(estado.conversas_feitas)}/{numero(estado.conversas_total)} {t("conversas")} · {numero(estado.mensagens_importadas)} {t("mensagens")}
                    </p>
                  </>
                )}
                {estado?.fase === "concluida" && (
                  <>
                    <p><strong>{t("Importação concluída.")}</strong></p>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">
                      <li>{numero(estado.mensagens_importadas)} {t("mensagens importadas")}</li>
                      <li>{numero(estado.conversas_novas)} {t("conversas novas")} · {numero(estado.contatos_novos)} {t("contatos novos")}</li>
                      <li>{numero(estado.ja_existiam)} {t("já existiam")} · {numero(estado.midias_indisponiveis)} {t("mídias indisponíveis")}</li>
                    </ul>
                  </>
                )}
                {estado?.fase === "erro" && (
                  <p role="alert" className="text-destructive">{t("A importação parou por um erro. Pode tentar de novo; o que já entrou não duplica.")}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{estado?.fase === "pronto" ? t("Cancelar") : t("Fechar")}</AlertDialogCancel>
            {estado?.fase === "pronto" && estado.mensagens_novas > 0 && (
              <AlertDialogAction onClick={(e) => { e.preventDefault(); pedir.mutate("importar"); }}>
                {t("Importar agora")}
              </AlertDialogAction>
            )}
            {estado?.fase === "erro" && (
              <AlertDialogAction onClick={(e) => { e.preventDefault(); pedir.mutate("analisar"); }}>{t("Tentar de novo")}</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
