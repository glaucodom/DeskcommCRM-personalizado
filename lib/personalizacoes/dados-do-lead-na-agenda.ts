/**
 * Fork: o evento que a IA cria no Google Agenda diz de quem é a reunião.
 *
 * Antes saía só "Apresentação CRTI ERP" e o link do Meet: quem abria o calendário não
 * sabia a empresa, quem era a pessoa nem que a Clara tinha marcado. O título e a descrição
 * agora nascem dos dados que a IA já tem na hora de marcar (empresa, contato, telefone,
 * e-mail, segmento). Só entra o que a PRÓPRIA pessoa disse à IA: a descrição vai para o
 * convite dela também.
 */

export interface DadosDoLeadNaAgenda {
  nome?: string | null;
  empresa?: string | null;
  telefone?: string | null;
  email?: string | null;
  segmentos?: readonly string[] | null;
  /** Nome do agente que marcou, ex.: "Clara 1 (Comercial Não Clientes CRTI)". */
  agente?: string | null;
}

function limpo(v: string | null | undefined): string {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

/** "Clara 1 (Comercial Não Clientes CRTI)" → "Clara 1". */
export function nomeCurtoDoAgente(agente: string | null | undefined): string {
  return limpo(limpo(agente).split("(")[0]);
}

export function primeiroNome(nome: string | null | undefined): string {
  return limpo(nome).split(" ")[0] ?? "";
}

export function tituloDaReuniao(tituloDoTipo: string, d: DadosDoLeadNaAgenda): string {
  const empresa = limpo(d.empresa);
  const nome = primeiroNome(d.nome);
  let titulo = tituloDoTipo;
  if (empresa) titulo += ` — ${empresa}`;
  if (nome) titulo += empresa ? ` (${nome})` : ` — ${nome}`;
  return titulo.slice(0, 200);
}

export function descricaoDaReuniao(d: DadosDoLeadNaAgenda): string {
  const agente = nomeCurtoDoAgente(d.agente);
  const linhas: string[] = [
    agente ? `Agendado pela ${agente} (IA), pelo WhatsApp.` : "Agendado pela IA, pelo WhatsApp.",
    "",
  ];
  const campo = (rotulo: string, valor: string | null | undefined) => {
    const v = limpo(valor);
    if (v) linhas.push(`${rotulo}: ${v}`);
  };
  campo("Empresa", d.empresa);
  campo("Contato", d.nome);
  campo("WhatsApp", d.telefone);
  campo("E-mail", d.email);
  const segmentos = (d.segmentos ?? []).map(limpo).filter(Boolean).join(", ");
  campo("Segmento", segmentos);
  return linhas.join("\n").trim().slice(0, 2000);
}
