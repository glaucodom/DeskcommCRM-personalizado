"use client";
/** Botão "Renomear" do cartão do número (personalização do fork). */
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { NomeDoNumeroDialog } from "./NomeDoNumeroDialog";

export function RenomearNumero({
  channelId,
  nomeAtual,
  onSalvo,
}: {
  channelId: string;
  nomeAtual: string | null;
  onSalvo: () => void;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(nome: string) {
    setOcupado(true);
    try {
      const res = await fetch(`/api/v1/channel-sessions/${channelId}/nome`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: nome }),
      });
      if (!res.ok) {
        toast.error(t("Não foi possível salvar. Tente novamente."));
        return;
      }
      toast.success(t("Nome do número salvo."));
      setAberto(false);
      onSalvo();
    } catch {
      toast.error(t("Não foi possível salvar. Tente novamente."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAberto(true)} data-testid="renomear-numero">
        {t("Renomear")}
      </Button>
      <NomeDoNumeroDialog
        aberto={aberto}
        titulo={t("Nome do número")}
        nomeInicial={nomeAtual ?? ""}
        rotuloDoBotao={t("Salvar")}
        ocupado={ocupado}
        onConfirmar={(nome) => void salvar(nome)}
        onFechar={() => setAberto(false)}
      />
    </>
  );
}
