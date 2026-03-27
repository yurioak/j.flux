const { clickFirstAvailableInFrames } = require("./frames");
const { sleep } = require("./core");

async function openProcess(page, processNumber) {
  const frames = page.frames();
  const strategies = [
    { selector: "#q", submitSelector: "#sbmPesquisar" },
    { selector: 'input[name="q"]', submitSelector: "#sbmPesquisar" },
    { selector: "#txtPesquisaRapida" }
  ];

  for (const frame of frames) {
    for (const strategy of strategies) {
      try {
        const locator = frame.locator(strategy.selector).first();
        const count = await locator.count().catch(() => 0);
        if (!count) continue;

        await locator.click({ timeout: 5000 }).catch(() => null);
        await locator.fill(processNumber, { timeout: 5000 });

        if (strategy.submitSelector) {
          const submitCount = await frame.locator(strategy.submitSelector).count().catch(() => 0);
          if (submitCount) {
            await frame.locator(strategy.submitSelector).first().click({ timeout: 5000 });
          } else {
            await locator.press("Enter", { timeout: 5000 });
          }
        } else {
          await locator.press("Enter", { timeout: 5000 });
        }

        // Aguarda a árvore carregar (iframe ifrArvore ou divArvore)
        // Isso é crucial para DURABILIDADE em redes lentas
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => null);
        
        // Tenta detectar se a árvore apareceu antes de prosseguir
        const treeFound = await page.locator("#ifrArvore, #divArvore, .infraArvore").count().catch(() => 0);
        if (!treeFound) {
           await sleep(2000); // Dá um fôlego extra se não achou de cara
        }

        // Seletores de link do processo (incluindo span para maior interoperabilidade)
        const rootSelectors = [
          `a:has-text("${processNumber}")`,
          `#divArvore a[title*="${processNumber}" i]`,
          `.infraArvoreObjeto:has-text("${processNumber}")`,
          `span:has-text("${processNumber}")`,
          `a:has-text("${processNumber.replace(/[^0-9]/g, '')}")` // Tenta sem pontuação se falhar
        ];

        const clickRoot = await clickFirstAvailableInFrames(page, rootSelectors);
        
        if (clickRoot.ok) {
          // Espera finalizar o carregamento do frame de visualização
          await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => null);
          await sleep(1000);
          return {
            ok: true,
            selector: strategy.selector,
            finalUrl: page.url(),
            title: await page.title().catch(() => "")
          };
        }
      } catch (err) {
        continue;
      }
    }
  }

  return { ok: false };
}

async function getTreeState(page) {
  try {
    const frames = page.frames();
    const nodes = [];
    for (const frame of frames) {
      const url = frame.url();
      const frameName = frame.name();
      // O SEI geralmente usa 'ifrArvore' ou 'arvore.php'
      if (frameName.includes("ifrArvore") || url.includes("tree.php") || url.includes("arvore.php")) {
        const anchors = await frame.locator("a").all().catch(() => []);
        for (const a of anchors) {
          const text = await a.textContent().catch(() => "");
          if (text) nodes.push(text.trim().replace(/\s+/g, ' '));
        }
      }
    }
    return nodes;
  } catch (_error) {
    return [];
  }
}

async function checkDocumentInTree(page, processNumber, uniqueDescription = "", previousState = []) {
  try {
    const currentNodes = await getTreeState(page);
    
    // Criterio 1: Busca por descricao UNICA (ex: timestamp ou runId na descrição)
    if (uniqueDescription) {
      const found = currentNodes.some(node => node.includes(uniqueDescription));
      if (found) return { ok: true, source: "exact-unique-description" };
    }

    // Criterio 2: Se o numero de nodes aumentou, e sinal de novo documento
    if (currentNodes.length > previousState.length) {
      // Diferenca entre os nomes - algum novo node apareceu que nao estava la?
      const newNodes = currentNodes.filter(n => !previousState.includes(n));
      if (newNodes.length > 0) {
        return { ok: true, source: "tree-nodes-added", details: newNodes.join(', ') };
      }
    }

    return { ok: false };
  } catch (_error) {
    return { ok: false };
  }
}

module.exports = {
  openProcess,
  getTreeState,
  checkDocumentInTree
};
