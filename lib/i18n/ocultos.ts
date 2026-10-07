/**
 * Idiomas que ESTA instalação esconde de quem usa — `IDIOMAS_OCULTOS`
 * no `.env` (códigos separados por vírgula, ex.: `es`). Vazio, que é o padrão,
 * não esconde nada e o produto se comporta exatamente como o oficial.
 *
 * Personalização do fork glaucodom/DeskcommCRM-personalizado: o dono quer o
 * sistema só em português. Por que configuração no servidor e não uma lista no
 * código: os testes do projeto oficial provam que o espanhol aparece e traduz,
 * e o robô que traz cada versão oficial roda a suíte inteira antes de publicar.
 * Esconder no código obrigaria a reescrever esses testes no fork — e cada
 * mudança oficial neles viraria conflito parando o robô.
 *
 * A tradução continua no código. Esconder é: não oferecer (seletor do topo,
 * Perfil, Organização), não aceitar na troca, e quem já tinha o idioma salvo
 * (pessoa ou organização) ou chega com o navegador nele vê o padrão.
 *
 * Server-only (lê `process.env`). A tela recebe a lista pronta pelo
 * `IdiomaProvider`.
 */
import { IDIOMA_PADRAO, normalizarIdioma, type Idioma } from "./idiomas";

export function idiomasOcultosDaInstalacao(
  bruto: string | undefined = process.env.IDIOMAS_OCULTOS,
): string[] {
  return (bruto ?? "")
    .split(",")
    .map((codigo) => codigo.trim())
    .filter((codigo) => codigo.length > 0 && codigo !== IDIOMA_PADRAO);
}

/** O idioma da TELA: o de sempre, menos o que esta instalação esconde. */
export function idiomaDaTela(
  bruto: string | null | undefined,
  ocultos: readonly string[] = idiomasOcultosDaInstalacao(),
): Idioma {
  if (ocultos.includes(bruto ?? "")) return IDIOMA_PADRAO;
  return normalizarIdioma(bruto);
}
