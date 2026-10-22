"use client";
/**
 * Fork #25: o funil de CADA número conectado, numa lista só (Configurações ›
 * Atendimento). A mesma escolha existe no cartão do número em Conexões; aqui o
 * administrador vê todos os números de uma vez e vincula cada um ao seu funil.
 */
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { FunilDoNumero } from "@/components/connections/FunilDoNumero";
import { useT } from "@/hooks/i18n/useT";

interface Numero {
  id: string;
  display_name: string | null;
  phone_number: string | null;
}

export function FunilDosNumeros() {
  const t = useT();
  const [numeros, setNumeros] = useState<Numero[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    void fetch("/api/v1/channel-sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((corpo: { data?: Numero[] } | null) => {
        if (!cancelado) setNumeros(corpo?.data ?? []);
      })
      .catch(() => {
        if (!cancelado) setNumeros([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (!numeros || numeros.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("Funil de cada número")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "Escolha, para cada número conectado, o funil onde nascem os leads de quem chamar por ele. Sem escolha, vale o funil padrão da empresa. Vale para leads novos.",
          )}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {numeros.map((n) => (
          <div key={n.id} className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">{n.display_name ?? n.phone_number ?? n.id.slice(0, 8)}</p>
            {n.display_name && n.phone_number ? (
              <p className="text-xs text-muted-foreground">{n.phone_number}</p>
            ) : null}
            <FunilDoNumero channelId={n.id} />
          </div>
        ))}
      </div>
    </Card>
  );
}
