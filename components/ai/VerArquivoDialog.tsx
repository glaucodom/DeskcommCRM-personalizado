"use client";

import { useT } from "@/hooks/i18n/useT";
/**
 * O ARQUIVO COMO FOI GUARDADO.
 *
 * "Ver o que ele aprendeu" mostra os trechos depois da preparação; aqui é o
 * texto inteiro que a pessoa enviou ou colou, para conferir sem ter de baixar
 * nada. Somente leitura: fechar, por botão, Esc ou clique fora, não grava nada.
 *
 * O texto vai num `<pre>` como filho de texto do React, nunca como HTML: um
 * Markdown com `<script>` aparece escrito, não executa.
 */
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTextoDoMaterial } from "@/hooks/ai/useTextoDoMaterial";
import { copyToClipboard } from "@/lib/clipboard";

interface Props {
  sourceId: string;
  nome: string;
  aberto: boolean;
  onFechar: () => void;
}

export function VerArquivoDialog({ sourceId, nome, aberto, onFechar }: Props) {
  const t = useT();
  const { data, isLoading, isError } = useTextoDoMaterial(sourceId, aberto);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!data) return;
    if (await copyToClipboard(data.texto)) {
      setCopiado(true);
      toast.success(t("Texto copiado."));
    } else {
      toast.error(t("Não consegui copiar. Selecione o texto e copie à mão."));
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t("Arquivo enviado de")} “{nome}”
          </DialogTitle>
          <DialogDescription>
            {data?.filename ? `${data.filename} · ` : ""}
            {data ? `${t("versão")} ${data.versao}` : t("O texto como está guardado agora.")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto" data-testid="material-arquivo-conteudo">
          {isLoading ? <p className="text-sm text-text-muted">{t("Carregando…")}</p> : null}
          {isError ? (
            <p className="text-sm text-error-fg" role="alert">
              {t("Não consegui ler o arquivo agora. Feche e tente de novo em instantes.")}
            </p>
          ) : null}
          {data ? (
            <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface p-3 font-mono text-sm">
              {data.texto}
            </pre>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={copiar}
            disabled={!data}
            data-testid="material-arquivo-copiar"
          >
            {copiado ? t("Copiado") : t("Copiar")}
          </Button>
          <Button onClick={onFechar} data-testid="material-arquivo-fechar">
            {t("Fechar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
