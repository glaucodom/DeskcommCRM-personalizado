import { notFound } from "next/navigation";

import { moduloLigado } from "@/lib/instalacao/modulos";
import { orgAtivaAtendePessoas } from "@/lib/personalizacoes/tipo-de-cliente-servidor";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Empresas, pessoas e importação são módulo opcional da instalação, desligado
 * por padrão (doc 68). Desligado, estas telas não existem para ninguém: quem
 * liga é quem administra o servidor, em `/admin/sistema`.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await moduloLigado(createAdminClient(), "crm_b2b"))) notFound();
  // Fork #20: organização B2C não tem esta área.
  if (await orgAtivaAtendePessoas()) notFound();
  return children;
}
