import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Margem das telas = a do Funil (`docs/design-system/10-margem-das-telas.md`).
 *
 * Quem dá a margem é o `main` do AppShell. O wrapper da tela é `w-full` e só:
 * sem `mx-auto`, sem `max-w-*`, sem `p-*`/`px-*` próprios. Padding do wrapper
 * soma com o do `main` e tira o conteúdo do alinhamento com o seletor de
 * organização e o botão do usuário (o hub CRM ficava com 48 px em vez de 24 px).
 *
 * Telas novas padronizadas entram em TELAS conforme o Glauco for pedindo.
 */
const RAIZ = process.cwd();

const TELAS: Array<[arquivo: string, wrapper: RegExp]> = [
  ["components/shell/NavHub.tsx", /<div className="(flex h-full w-full flex-col gap-8)">/],
  ["app/app/tasks/_components/TarefasClient.tsx", /<div className="(flex w-full flex-col gap-6)">/],
  ["app/app/proposals/_client.tsx", /<div className="(w-full space-y-4)">/],
  ["app/app/proposals/[id]/_client.tsx", /<div className="(w-full space-y-4)">/],
];

describe("margem das telas igual à do Funil", () => {
  for (const [arquivo, wrapper] of TELAS) {
    it(`${arquivo}: wrapper w-full, sem largura presa nem padding próprio`, () => {
      const fonte = readFileSync(join(RAIZ, arquivo), "utf8");
      const achado = fonte.match(wrapper);
      expect(achado, "wrapper da tela não está no padrão").not.toBeNull();
      const classes = achado![1]!;
      expect(classes).toContain("w-full");
      expect(classes).not.toMatch(/\bmx-auto\b|\bmax-w-|\bp-\d|\bpx-\d|\bsm:p-\d/);
    });
  }
});
