"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import {
  cnpjVazioOuValido,
  mascaraCnpj,
  segmentosDeTexto,
  SEGMENTOS_SUGERIDOS,
} from "@/lib/personalizacoes/dados-da-empresa";
import { formatCnpj } from "@/lib/crm-b2b/normalize";

interface Props {
  contactId: string;
  empresa?: string | null;
  cnpj?: string | null;
  segmentos?: string[] | null;
  readonly?: boolean;
}

/** Empresa, CNPJ e segmento do contato, editáveis direto no painel do Inbox (fork). */
export function DadosDaEmpresaDoContato({ contactId, empresa, cnpj, segmentos, readonly }: Props) {
  const t = useT();
  const update = useUpdateContact(contactId);
  const inicial = {
    empresa: empresa ?? "",
    cnpj: cnpj ? formatCnpj(cnpj) : "",
    segmentos: (segmentos ?? []).join(", "),
  };
  const [v, setV] = useState(inicial);
  const mudou = v.empresa !== inicial.empresa || v.cnpj !== inicial.cnpj || v.segmentos !== inicial.segmentos;

  async function salvar() {
    if (!cnpjVazioOuValido(v.cnpj)) {
      toast.error(t("CNPJ deve ter 14 números"));
      return;
    }
    try {
      await update.mutateAsync({
        empresa: v.empresa.trim(),
        cnpj: v.cnpj.trim(),
        segmentos: segmentosDeTexto(v.segmentos),
      });
      toast.success(t("Dados da empresa salvos"));
    } catch {
      // o toast de erro já saiu no hook
    }
  }

  return (
    <section>
      <h3 className="text-xs font-semibold text-text">{t("Dados da empresa")}</h3>
      <div className="mt-2 space-y-2">
        <div className="space-y-1">
          <Label htmlFor="dc-empresa" className="text-xs">{t("Nome da empresa")}</Label>
          <Input
            id="dc-empresa"
            className="h-8 text-sm"
            value={v.empresa}
            disabled={readonly}
            onChange={(e) => setV({ ...v, empresa: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dc-cnpj" className="text-xs">CNPJ</Label>
          <Input
            id="dc-cnpj"
            className="h-8 text-sm"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            value={v.cnpj}
            disabled={readonly}
            onChange={(e) => setV({ ...v, cnpj: mascaraCnpj(e.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dc-segmentos" className="text-xs">{t("Segmento")}</Label>
          <Input
            id="dc-segmentos"
            className="h-8 text-sm"
            list="dc-segmentos-sugeridos"
            placeholder={t("Segmentos (separe por vírgula)")}
            value={v.segmentos}
            disabled={readonly}
            onChange={(e) => setV({ ...v, segmentos: e.target.value })}
          />
          <datalist id="dc-segmentos-sugeridos">
            {SEGMENTOS_SUGERIDOS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        {!readonly && (
          <Button size="sm" className="h-7 px-3 text-xs" disabled={!mudou || update.isPending} onClick={() => void salvar()}>
            {update.isPending ? t("Salvando…") : t("Salvar dados da empresa")}
          </Button>
        )}
      </div>
    </section>
  );
}
