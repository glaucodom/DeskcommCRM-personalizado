import { redirect } from "next/navigation";

/**
 * Fork #21: porta em Configurações › Sua empresa para a tela de Etapas do funil
 * e campos personalizados do contato, que mora em `/app/settings/tenant/pipelines`
 * (grupo CRM). O registro de navegação indexa por href, então a entrada de
 * Configurações precisa de um endereço próprio.
 */
export default function FunilEmConfiguracoesPage(): never {
  redirect("/app/settings/tenant/pipelines");
}
