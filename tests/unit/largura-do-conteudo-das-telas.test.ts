import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hub (CRM, IA, Análise), Tarefas e Propostas usam a MESMA largura de conteúdo.
 * Antes o hub não tinha limite (quase a tela toda) e Tarefas/Propostas paravam em
 * `max-w-5xl`: telas curtas ao lado de telas longas. A régua é `max-w-6xl`,
 * centralizada; no celular o wrapper segue `w-full`, com margem de 16 px.
 */
const RAIZ = process.cwd();

const TELAS = [
  "components/shell/NavHub.tsx",
  "app/app/tasks/_components/TarefasClient.tsx",
  "app/app/proposals/_client.tsx",
  "app/app/proposals/[id]/_client.tsx",
];

describe("largura do conteúdo das telas", () => {
  for (const arquivo of TELAS) {
    it(`${arquivo} usa o wrapper centralizado de max-w-6xl`, () => {
      const fonte = readFileSync(join(RAIZ, arquivo), "utf8");
      expect(fonte).toMatch(/mx-auto[^"`]*w-full[^"`]*max-w-6xl|mx-auto[^"`]*max-w-6xl[^"`]*w-full/);
      expect(fonte).not.toContain("max-w-5xl");
    });
  }
});
