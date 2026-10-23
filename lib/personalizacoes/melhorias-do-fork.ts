/**
 * Lista curta do que este fork tem a mais que o DeskcommCRM oficial. Aparece em
 * Configurações › Atualização (a tela que o link da versão no rodapé abre).
 * A lista completa, com arquivos e testes, é `PERSONALIZACOES-DO-FORK.md`; o teste
 * `melhorias-do-fork-em-dia` falha se um número daquele documento faltar aqui.
 */
export interface MelhoriaDoFork {
  n: number;
  titulo: string;
  /** Primeira versão do fork em que entrou, quando se sabe. */
  desde?: string;
}

export const MELHORIAS_DO_FORK: readonly MelhoriaDoFork[] = [
  { n: 27, titulo: "Contato sem nome recebe o nome salvo na agenda do celular", desde: "1.87.0-glauco.5" },
  { n: 26, titulo: "Nome de pessoa sempre com a primeira letra maiúscula (Maria da Silva Oliveira)", desde: "1.87.0-glauco.5" },
  { n: 25, titulo: "Funil do número: quem chama por um número vira lead no funil escolhido para ele", desde: "1.87.0-glauco.3" },
  { n: 24, titulo: "Nova etiqueta (nome e cor) em Configurações › Tags", desde: "1.87.0-glauco.2" },
  { n: 23, titulo: "Funil padrão por pessoa, definido em Equipe; link “Todos os funis”", desde: "1.87.0-glauco.2" },
  { n: 22, titulo: "B2C no painel do Inbox e no Novo Lead" },
  { n: 21, titulo: "Atalho “Funil” em Configurações › Sua empresa" },
  { n: 20, titulo: "Tipo de cliente por empresa: B2B (empresas) ou B2C (pessoas)" },
  { n: 19, titulo: "Dados da empresa no Inbox e no Novo Lead" },
  { n: 18, titulo: "Telefone com +55 e máscara, e e-mail validado, no cadastro" },
  { n: 17, titulo: "Empresa, CNPJ e Segmentos no Novo contato e no Inbox" },
  { n: 16, titulo: "Cliente (etiqueta “cliente”) vai para a Clara 2" },
  { n: 15, titulo: "Empresa, CNPJ e Segmentos no contato" },
  { n: 14, titulo: "O agente grava os dados do lead no CRM" },
  { n: 13, titulo: "Mensagem do link do Meet mais limpa" },
  { n: 12, titulo: "Ida da agenda ao Google a cada minuto" },
  { n: 11, titulo: "Agendamento autoriza a confirmação ao cliente" },
  { n: 10, titulo: "Instruções do agente de IA até 50.000 caracteres" },
  { n: 9, titulo: "Nome do número ao conectar e botão Renomear" },
  { n: 8, titulo: "Cada vendedor vê só os números em que é responsável" },
  { n: 7, titulo: "Inbox abre na aba “Minhas”" },
  { n: 6, titulo: "Esconder idiomas (só português)" },
  { n: 5, titulo: "Uma atualização por vez" },
  { n: 4, titulo: "Link de convite vai direto para Criar conta" },
  { n: 3, titulo: "“Atualizar agora” instala as versões deste fork; robô sincroniza com o oficial" },
  { n: 2, titulo: "Base de Conhecimento: ver arquivo e editar texto" },
  { n: 1, titulo: "Versão do rodapé é link para esta tela" },
];
