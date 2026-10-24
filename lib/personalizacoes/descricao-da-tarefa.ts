/**
 * Quando a descrição da tarefa pede o botão "Ver tudo".
 *
 * A lista corta a descrição em uma linha. Texto que cabe numa linha não precisa
 * de botão; texto comprido, ou com quebra de linha, precisa — senão só dá para
 * lê-lo abrindo a edição. O limite é de caracteres e não de medida da tela de
 * propósito: medir exigiria layout, e um botão a mais num texto que por sorte
 * coube não atrapalha ninguém.
 */
export const LIMITE_DA_DESCRICAO_RECOLHIDA = 90;

export function descricaoPedeVerTudo(descricao: string | null | undefined): boolean {
  const texto = (descricao ?? "").trim();
  if (texto === "") return false;
  return texto.length > LIMITE_DA_DESCRICAO_RECOLHIDA || texto.includes("\n");
}
