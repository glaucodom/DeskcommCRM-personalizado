"use client";
/** Seletor "Funil deste número" no cartão do número (fork #25). */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/hooks/i18n/useT";

const SEM_FUNIL = "__padrao_da_empresa__";

interface Dados {
  funil_id: string | null;
  funis: Array<{ id: string; name: string }>;
}

export function FunilDoNumero({ channelId }: { channelId: string }) {
  const t = useT();
  const [dados, setDados] = useState<Dados | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void fetch(`/api/v1/channel-sessions/${channelId}/funil`)
      .then((r) => (r.ok ? r.json() : null))
      .then((corpo: { data?: Dados } | null) => {
        if (!cancelado && corpo?.data) setDados(corpo.data);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [channelId]);

  // Sem leitura (sem permissão ou sem a coluna), o seletor simplesmente não aparece.
  if (!dados || dados.funis.length === 0) return null;

  async function trocar(valor: string) {
    const funilId = valor === SEM_FUNIL ? null : valor;
    setOcupado(true);
    try {
      const res = await fetch(`/api/v1/channel-sessions/${channelId}/funil`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funil_id: funilId }),
      });
      if (!res.ok) {
        toast.error(t("Não foi possível salvar. Tente novamente."));
        return;
      }
      setDados((antes) => (antes ? { ...antes, funil_id: funilId } : antes));
      toast.success(t("Funil do número salvo."));
    } catch {
      toast.error(t("Não foi possível salvar. Tente novamente."));
    } finally {
      setOcupado(false);
    }
  }

  const atual = dados.funis.some((f) => f.id === dados.funil_id) ? (dados.funil_id as string) : SEM_FUNIL;
  return (
    <div className="space-y-1">
      <Label className="text-xs">{t("Funil deste número")}</Label>
      <Select value={atual} onValueChange={(v) => void trocar(v)} disabled={ocupado}>
        <SelectTrigger className="h-8 w-full text-sm" data-testid="funil-do-numero">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM_FUNIL}>{t("Padrão da empresa")}</SelectItem>
          {dados.funis.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {t("Quem chamar por este número vira lead neste funil.")}
      </p>
    </div>
  );
}
