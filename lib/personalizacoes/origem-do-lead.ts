/**
 * Origem do lead (fork): o que a pessoa responde a "como você conheceu a CRTI?" vira um
 * nome curto e igual para todo mundo — "Google", "Instagram", "IA", "IA (ChatGPT)".
 * Assim o filtro e a leitura na tela não dependem de como cada um escreveu ("vi na ia",
 * "gogle", "pelo insta").
 */

const IAS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(chat\s*gpt|gpt|openai|open ai)\b/, "ChatGPT"],
  [/\bgemini\b/, "Gemini"],
  [/\bclaude\b/, "Claude"],
  [/\bcopilot\b/, "Copilot"],
  [/\bperplexity\b/, "Perplexity"],
  [/\bgrok\b/, "Grok"],
  [/\bdeep\s*seek\b/, "DeepSeek"],
];

const CONHECIDAS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(google|gogle|googel|googl)\b/, "Google"],
  [/\b(instagram|insta|instagran|ig)\b/, "Instagram"],
  [/\b(facebook|face|fb)\b/, "Facebook"],
  [/\b(linkedin|linked in)\b/, "LinkedIn"],
  [/\b(youtube|you tube)\b/, "YouTube"],
  [/\b(tiktok|tik tok)\b/, "TikTok"],
  [/\b(indicacao|indicou|indicado|indicada|indicaram)\b/, "Indicação"],
];

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function padronizarOrigem(texto: string): string {
  const original = texto.trim();
  if (original === "") return original;
  const t = semAcento(original.toLowerCase());
  for (const [re, nome] of IAS) if (re.test(t)) return `IA (${nome})`;
  for (const [re, nome] of CONHECIDAS) if (re.test(t)) return nome;
  if (/\b(ia|i\.a\.|ai|inteligencia artificial)\b/.test(t)) return "IA";
  return original.charAt(0).toUpperCase() + original.slice(1);
}
