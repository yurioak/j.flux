const { launchBrowser } = require("../../runner/browser");
const {
  collectInputCandidates,
  isLikelyProcessSearchCandidate,
  writeDiagnostics
} = require("../../runner/page-diagnostics");
const { ask } = require("../../runner/prompt");
const { saveScreenshot } = require("../../runner/screenshot");

// Adaptação para Actions SEI
const sei = require("../../actions/sei");

async function findCandidateFrames(page) {
  const diagnostics = await collectInputCandidates(page);
  return diagnostics
    .map((frameInfo) => ({
      ...frameInfo,
      candidates: frameInfo.elements.filter(isLikelyProcessSearchCandidate)
    }))
    .filter((frameInfo) => frameInfo.candidates.length > 0);
}

async function fillCandidate(locator, processNumber) {
  await locator.click({ timeout: 1000 });
  await locator.fill(processNumber, { timeout: 1000 });
}

async function trySubmitWithinFrame(page, frame, processNumber, selector, submitSelector) {
  const locator = frame.locator(selector).first();
  const count = await frame.locator(selector).count();

  if (!count) {
    return null;
  }

  try {
    await fillCandidate(locator, processNumber);

    if (submitSelector) {
      const submitCount = await frame.locator(submitSelector).count();
      if (submitCount) {
        await frame.locator(submitSelector).first().click({ timeout: 1000 });
      } else {
        await locator.press("Enter", { timeout: 1000 });
      }
    } else {
      await locator.press("Enter", { timeout: 1000 });
    }

    await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => null);
    await sei.sleep(500);

    return {
      ok: true,
      selector,
      submitSelector: submitSelector || "Enter",
      frameUrl: frame.url()
    };
  } catch (_error) {
    return null;
  }
}

async function attemptSearch(page, processNumber) {
  const frames = page.frames();
  const strategies = [
    { selector: "#q", submitSelector: "#sbmPesquisar" },
    { selector: 'input[name="q"]', submitSelector: "#sbmPesquisar" },
    { selector: "#txtPesquisaRapida" },
    { selector: 'input[placeholder*="Processo" i]' },
    { selector: 'input[placeholder*="Pesquisa" i]' },
    { selector: 'input[title*="Processo" i]' },
    { selector: 'input[title*="Pesquisa" i]' },
    { selector: 'input[name*="processo" i]' },
    { selector: 'input[name*="protocolo" i]' },
    { selector: 'input[id*="processo" i]' },
    { selector: 'input[id*="protocolo" i]' },
    { selector: 'input[type="search"]' }
  ];

  for (const frame of frames) {
    for (const strategy of strategies) {
      const result = await trySubmitWithinFrame(
        page,
        frame,
        processNumber,
        strategy.selector,
        strategy.submitSelector
      );

      if (result?.ok) {
        return result;
      }
    }
  }

  return {
    ok: false
  };
}

async function detectVisibleResults(page, processNumber) {
  const frames = page.frames();

  for (const frame of frames) {
    const state = await frame
      .evaluate((expectedProcessNumber) => {
        const currentQuery =
          document.querySelector("#q")?.value ||
          document.querySelector('input[name="q"]')?.value ||
          document.querySelector("#txtPesquisaRapida")?.value ||
          "";

        const processLinks = Array.from(document.querySelectorAll("a"))
          .map((anchor) => (anchor.textContent || "").trim())
          .filter((text) => /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(text));

        return {
          currentQuery,
          matchingLink: processLinks.find((text) => text === expectedProcessNumber) || null,
          firstProcessLink: processLinks[0] || null,
          processLinkCount: processLinks.length
        };
      }, processNumber)
      .catch(() => null);

    if (!state) {
      continue;
    }

    if (
      state.currentQuery === processNumber ||
      state.matchingLink ||
      state.processLinkCount > 0
    ) {
      return {
        ok: true,
        frameUrl: frame.url(),
        currentQuery: state.currentQuery,
        matchingLink: state.matchingLink,
        firstProcessLink: state.firstProcessLink,
        processLinkCount: state.processLinkCount
      };
    }
  }

  return {
    ok: false
  };
}

function printManualLoginInstructions(context, session) {
  sei.printManualLoginInstructions(context, session);
}

async function runFlow(context) {
  const seiUrl = context.input.seiUrl || context.settings.sei?.baseUrl;
  const manualLogin =
    String(context.input.manualLogin || "").toLowerCase() === "true" ||
    String(context.input.manualLogin || "").toLowerCase() === "1";
  const processNumber = context.input.processo || "";

  if (context.dryRun) {
    return {
      status: "dry-run",
      message: `Teste local concluido para consultar-processo. Processo: ${processNumber || "nao informado"}`
    };
  }

  if (!seiUrl || seiUrl === "https://SEU-SEI-AQUI") {
    throw new Error(
      "Configure a URL do SEI em config/settings.base.json ou no perfil do usuario."
    );
  }

  if (!processNumber) {
    throw new Error("Informe --input processo=<numero do processo>.");
  }

  const session = await launchBrowser(context.settings, {
    userDataDir: context.storage.browserProfileDir
  });
  const { browser, executablePath } = session;
  let screenshotFile = null;

  try {
    console.log("");
    console.log(`Abrindo o SEI para consultar o processo ${processNumber}...`);
    sei.reportProgress(context, `Abrindo o SEI para consultar o processo ${processNumber}.`, {
      phase: "opening-browser",
      status: "running"
    });
    const page = browser.pages()[0] || (await browser.newPage());
    page.setDefaultNavigationTimeout(Number(context.settings.sei?.navigationTimeoutMs || 15000));
    await page.goto(seiUrl, { waitUntil: "domcontentloaded" });
    screenshotFile = await saveScreenshot(page, context, "sei-home");

    if (manualLogin) {
      sei.reportProgress(context, "Verificando se voce ja esta autenticado...", { phase: "check-login", status: "running" });
      const sessionCheck = await sei.checkLoginStatus(page);

      if (sessionCheck.isLogged) {
        sei.reportProgress(context, `Sessão ativa detectada (${sessionCheck.source}). Pulando login manual.`, { 
          phase: "manual-login", 
          status: "finished" 
        });
      } else {
        sei.printManualLoginInstructions(context, session);
        sei.reportProgress(context, "Aguardando login manual e possivel 2FA no navegador.", {
          phase: "manual-login",
          status: "waiting-user",
          requiresConfirmation: true,
          confirmationLabel: "Ja conclui o login e o 2FA"
        });
        await sei.waitForConfirmation(context, {
          type: "manual-login",
          title: "Concluir login no SEI",
          message:
            "Finalize o login no navegador aberto. Se houver 2FA, conclua essa etapa e aguarde a tela principal do SEI carregar.",
          question: "Pressione Enter para continuar apos concluir o login...",
          confirmLabel: "Ja conclui o login e o 2FA"
        });
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => null);
        await sei.sleep(500);
      }
      screenshotFile = await saveScreenshot(page, context, "sei-after-login");
    }

    sei.reportProgress(context, `Tentando localizar o campo de pesquisa para o processo ${processNumber}.`, {
      phase: "searching",
      status: "running"
    });
    const searchResult = await attemptSearch(page, processNumber);
    const postSearchScreenshot = await saveScreenshot(page, context, "sei-after-search");
    const pageTitle = await page.title();
    const finalUrl = page.url();
    const resultState = await detectVisibleResults(page, processNumber);

    if (searchResult.ok || resultState.ok) {
      const status = resultState.matchingLink ? "search-results-found" : "search-submitted";
      const resultSummary = resultState.matchingLink
        ? `Resultado exato visivel: ${resultState.matchingLink}.`
        : resultState.firstProcessLink
          ? `Primeiro processo visivel na lista: ${resultState.firstProcessLink}.`
          : resultState.currentQuery
            ? `Consulta preenchida com: ${resultState.currentQuery}.`
            : "Pesquisa enviada no SEI.";

      return {
        status,
        message:
          `SEI acessado com sucesso para o processo ${processNumber}. ` +
          `Navegador utilizado: ${executablePath}. Titulo: ${pageTitle}. URL final: ${finalUrl}. ` +
          `Pesquisa tentada com seletor ${(searchResult.selector || "#q")} no frame ${(searchResult.frameUrl || resultState.frameUrl || finalUrl)}. ` +
          `Acionamento: ${(searchResult.submitSelector || "#sbmPesquisar")}. ${resultSummary} ` +
          `Screenshots: ${screenshotFile} e ${postSearchScreenshot}`
      };
    }

    const diagnostics = await collectInputCandidates(page);
    const diagnosticsFile = writeDiagnostics(context, diagnostics);
    const candidates = await findCandidateFrames(page);

    return {
      status: "search-not-found",
      message:
        `Login concluido, mas nenhum campo de pesquisa confiavel foi localizado para o processo ${processNumber}. ` +
        `Titulo: ${pageTitle}. URL final: ${finalUrl}. ` +
        `Frames com candidatos: ${candidates.length}. Diagnostico salvo em ${diagnosticsFile}. ` +
        `Screenshots: ${screenshotFile} e ${postSearchScreenshot}`
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  runFlow
};
