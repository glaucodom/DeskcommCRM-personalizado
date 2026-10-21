import type { Metadata } from "next";
import Link from "next/link";
import { NavHub } from "@/components/shell/NavHub";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { modulosLigados } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações" };

/**
 * Hub de Organização.
 *
 * A lista de cards que vivia aqui era uma segunda navegação escrita à mão, e
 * divergia do sidebar — Funis, Conexões e Audit Log apareciam como se fossem
 * configuração, quando são CRM, Canais e Análise. Agora o conteúdo vem do
 * registro, e o que sobra aqui é o que de fato é organização: sua conta, sua
 * empresa, e quem tem acesso ao quê.
 *
 * O card-ponte para "Canal oficial (Meta) e templates" que a `main` manteve
 * aqui NÃO foi perdido no merge — ele foi promovido. A ponte existia porque
 * conectar canal tinha duas respostas dependendo do WhatsApp, e quem já sabia
 * procurar em Configurações precisava continuar achando. Com o registro, o
 * grupo CANAIS fica visível no sidebar para todo admin e o ⌘K acha "canal
 * oficial" por nome — a pergunta passa a ter um lugar só, que é o que a ponte
 * tentava ensinar apontando para outro.
 */
export default async function SettingsHubPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  const idioma = user.idioma;

  // Fork #21: atalho para os campos personalizados do contato, que moram em
  // "Etapas do funil" (grupo CRM) e ninguém achava pelo hub de Configurações.
  const podeVerEtapas = ["admin", "manager"].includes(activeOrg?.role ?? "");

  return (
    <>
      {podeVerEtapas && (
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <Link
            href="/app/settings/tenant/pipelines"
            className="inline-flex flex-col gap-0.5 rounded-lg border border-border bg-surface px-4 py-3 text-sm hover:bg-surface-hover"
          >
            <span className="font-medium">{traduzir("Campos personalizados e etapas do funil", idioma)}</span>
            <span className="text-fg-muted">
              {traduzir("Crie campos extras no cadastro do contato e desenhe as colunas do funil.", idioma)}
            </span>
          </Link>
        </div>
      )}
    <NavHub
      group="organizacao"
      isPlatformAdmin={user.is_platform_admin && !user.support}
      role={activeOrg?.role ?? null}
      interfaceSettings={activeOrg?.interface_settings}
      // A porta do banco externo mora neste hub, e só existe com o módulo ligado.
      modulosLigados={await modulosLigados(createAdminClient())}
      title={traduzir("Configurações", idioma)}
      subtitle={traduzir("Sua conta, os dados da empresa e quem tem acesso ao quê.", idioma)}
      locale={idioma}
    />
    </>
  );
}
