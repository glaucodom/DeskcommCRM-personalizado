"use client";
import { useState } from "react";
import { toast } from "sonner";
import { CustomFieldsEditor, type CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { cpfVazioOuValido, mascaraCpf } from "@/lib/personalizacoes/tipo-de-cliente";

interface Props {
  contactId: string;
  birthdate?: string | null;
  /** Há CPF gravado? O número em si nunca volta do servidor. */
  cpfCadastrado: boolean;
  /** Campos personalizados do tipo Contato definidos no funil padrão. */
  camposDoContato: CustomFieldDef[];
  customFields?: Record<string, unknown> | null;
  readonly?: boolean;
}

/**
 * CPF, data de nascimento e campos personalizados do contato, editáveis direto
 * no painel do Inbox (fork #20). É o par do `DadosDaEmpresaDoContato` para
 * organização que vende para pessoas.
 */
export function DadosDaPessoaDoContato({
  contactId,
  birthdate,
  cpfCadastrado,
  camposDoContato,
  customFields,
  readonly,
}: Props) {
  const t = useT();
  const update = useUpdateContact(contactId);
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState(birthdate ?? "");
  const [campos, setCampos] = useState<Record<string, unknown>>(customFields ?? {});
  const mudou =
    cpf.trim() !== "" ||
    nascimento !== (birthdate ?? "") ||
    JSON.stringify(campos) !== JSON.stringify(customFields ?? {});

  async function salvar() {
    if (!cpfVazioOuValido(cpf)) {
      toast.error(t("CPF inválido"));
      return;
    }
    try {
      await update.mutateAsync({
        // O CPF nunca volta preenchido (dado sensível): só viaja quando digitado agora.
        ...(cpf.trim() ? { cpf: cpf.trim() } : {}),
        ...(nascimento !== (birthdate ?? "") && nascimento ? { birthdate: nascimento } : {}),
        // `custom_fields` é gravado inteiro pela API: manda o que já existe com a mudança.
        ...(camposDoContato.length > 0 ? { custom_fields: campos } : {}),
      });
      setCpf("");
      toast.success(t("Dados da pessoa salvos"));
    } catch {
      // o toast de erro já saiu no hook
    }
  }

  return (
    <section>
      <h3 className="text-xs font-semibold text-text">{t("Dados da pessoa")}</h3>
      <div className="mt-2 space-y-2">
        <div className="space-y-1">
          <Label htmlFor="dp-cpf" className="text-xs">CPF</Label>
          <Input
            id="dp-cpf"
            className="h-8 text-sm"
            inputMode="numeric"
            placeholder={cpfCadastrado ? t("Já cadastrado. Digite só para trocar.") : "000.000.000-00"}
            value={cpf}
            disabled={readonly}
            onChange={(e) => setCpf(mascaraCpf(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-nascimento" className="text-xs">{t("Data de nascimento")}</Label>
          <Input
            id="dp-nascimento"
            type="date"
            className="h-8 text-sm"
            value={nascimento}
            disabled={readonly}
            onChange={(e) => setNascimento(e.target.value)}
          />
        </div>
        {camposDoContato.length > 0 && (
          <CustomFieldsEditor
            fields={camposDoContato}
            mode="contact"
            value={campos}
            onChange={setCampos}
            className="gap-3 md:grid-cols-1"
          />
        )}
        {!readonly && (
          <Button size="sm" className="h-7 px-3 text-xs" disabled={!mudou || update.isPending} onClick={() => void salvar()}>
            {update.isPending ? t("Salvando…") : t("Salvar dados da pessoa")}
          </Button>
        )}
      </div>
    </section>
  );
}
