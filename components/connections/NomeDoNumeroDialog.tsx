"use client";
/**
 * Pergunta o nome do número (personalização do fork): ao conectar um número
 * novo e no botão "Renomear" do cartão. Ver lib/personalizacoes/nome-do-numero.ts.
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { TETO_DO_NOME_DO_NUMERO } from "@/lib/personalizacoes/nome-do-numero";

export function NomeDoNumeroDialog({
  aberto,
  titulo,
  nomeInicial,
  rotuloDoBotao,
  ocupado,
  onConfirmar,
  onFechar,
}: {
  aberto: boolean;
  titulo: string;
  nomeInicial: string;
  rotuloDoBotao: string;
  ocupado?: boolean;
  onConfirmar: (nome: string) => void;
  onFechar: () => void;
}) {
  const t = useT();
  const [nome, setNome] = useState(nomeInicial);
  useEffect(() => {
    if (aberto) setNome(nomeInicial);
  }, [aberto, nomeInicial]);

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirmar(nome);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>
              {t("Um nome fácil de reconhecer, como Comercial, Financeiro ou Suporte. Ele aparece no inbox no lugar do número.")}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={nome}
            maxLength={TETO_DO_NOME_DO_NUMERO}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t("Ex.: Comercial")}
            aria-label={t("Nome do número")}
            data-testid="nome-do-numero"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar} disabled={ocupado}>
              {t("Cancelar")}
            </Button>
            <Button type="submit" disabled={ocupado}>
              {rotuloDoBotao}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
