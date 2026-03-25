const fs = require("fs");
const path = require("path");
const { launchBrowser } = require("../../runner/browser");
const { ask } = require("../../runner/prompt");
const { saveScreenshot } = require("../../runner/screenshot");
const {
  collectInputCandidates,
  writeDiagnostics
} = require("../../runner/page-diagnostics");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeFileName(value) {
  return String(value || "sem-processo").replace(/[\\/:*?"<>|]/g, "-");
}

function reportProgress(context, message, extra = {}) {
  if (typeof context.reportProgress === "function") {
    context.reportProgress({
      message,
      ...extra
    });
  }
}

async function waitForConfirmation(context, payload) {
  if (typeof context.waitForUserConfirmation === "function") {
    const handled = await context.waitForUserConfirmation(payload);
    if (handled !== null && handled !== undefined) {
      return handled;
    }
  }

  return ask(payload.question || "Pressione Enter para continuar...");
}

function buildDispatchText(context) {
  const processNumber = context.input.processo || "nao informado";
  const unit = context.input.unidade || "nao informada";
  const responsible = context.input.responsavel || "nao informado";
  const summary = context.input.resumo || "Sem resumo adicional informado.";
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date());

  return [
    "DESPACHO",
    "",
    `Processo: ${processNumber}`,
    "",
    `A unidade ${unit} registra a presente movimentacao referente ao processo ${processNumber}.`,
    "",
    `Resumo: ${summary}`,
    "",
    "Encaminhem-se os autos para as providencias cabiveis.",
    "",
    `Responsavel pelo preparo: ${responsible}.`,
    "",
    `Gerado automaticamente em ${generatedAt}.`
  ].join("\n");
}

async function fillFirstAvailable(pageOrFrame, selectors, value) {
  for (const selector of selectors) {
    const locator = pageOrFrame.locator(selector).first();
    const count = await pageOrFrame.locator(selector).count().catch(() => 0);
    if (!count) {
      continue;
    }

    try {
      await locator.click({ timeout: 1000 });
      await locator.fill(value, { timeout: 1000 });
      return { ok: true, selector };
    } catch (_error) {
      continue;
    }
  }

  return { ok: false };
}

async function clickFirstAvailable(pageOrFrame, selectors) {
  for (const selector of selectors) {
    const locator = pageOrFrame.locator(selector).first();
    const count = await pageOrFrame.locator(selector).count().catch(() => 0);
    if (!count) {
      continue;
    }

    try {
      await locator.click({ timeout: 1500 });
      return { ok: true, selector };
    } catch (_error) {
      continue;
    }
  }

  return { ok: false };
}

async function openProcess(page, processNumber) {
  const frames = page.frames();
  const strategies = [
    { selector: "#q", submitSelector: "#sbmPesquisar" },
    { selector: 'input[name="q"]', submitSelector: "#sbmPesquisar" },
    { selector: "#txtPesquisaRapida" }
  ];

  for (const frame of frames) {
    for (const strategy of strategies) {
      const count = await frame.locator(strategy.selector).count().catch(() => 0);
      if (!count) {
        continue;
      }

      try {
        const locator = frame.locator(strategy.selector).first();
        await locator.click({ timeout: 1000 });
        await locator.fill(processNumber, { timeout: 1000 });

        if (strategy.submitSelector) {
          const submitCount = await frame.locator(strategy.submitSelector).count().catch(() => 0);
          if (submitCount) {
            await frame.locator(strategy.submitSelector).first().click({ timeout: 1000 });
          } else {
            await locator.press("Enter", { timeout: 1000 });
          }
        } else {
          await locator.press("Enter", { timeout: 1000 });
        }

        await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => null);
        await sleep(1500);

        const processLink = page.locator(`a:has-text("${processNumber}")`).first();
        const linkCount = await page.locator(`a:has-text("${processNumber}")`).count().catch(() => 0);

        if (linkCount) {
          await processLink.click({ timeout: 2000 });
          await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => null);
          await sleep(1500);
        }

        return {
          ok: true,
          selector: strategy.selector,
          finalUrl: page.url(),
          title: await page.title().catch(() => "")
        };
      } catch (_error) {
        continue;
      }
    }
  }

  return { ok: false };
}

async function clickIncludeDocument(page) {
  const popupPromise = page.context().waitForEvent("page", { timeout: 5000 }).catch(() => null);
  const clickResult = await clickFirstAvailable(page, [
    'a[title*="Incluir Documento" i]',
    'a[aria-label*="Incluir Documento" i]',
    'a:has-text("Incluir Documento")',
    'button:has-text("Incluir Documento")',
    'a[title*="Gerar Documento" i]',
    'a:has-text("Gerar Documento")'
  ]);

  if (!clickResult.ok) {
    return { ok: false };
  }

  const popup = await popupPromise;
  const targetPage = popup || page;
  await targetPage.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => null);
  await sleep(1200);

  return {
    ok: true,
    targetPage,
    selector: clickResult.selector
  };
}

async function chooseDocumentType(targetPage, documentType) {
  await clickFirstAvailable(targetPage, [
    'a[title*="Exibir todos os tipos" i]',
    'button:has-text("Exibir todos os tipos")',
    'a:has-text("Exibir todos os tipos")'
  ]);

  await fillFirstAvailable(targetPage, [
    'input[placeholder*="filtrar" i]',
    'input[title*="filtrar" i]',
    'input[name*="pesquisa" i]',
    'input[type="text"]'
  ], documentType);

  const clickType = await clickFirstAvailable(targetPage, [
    `a:has-text("${documentType}")`,
    `button:has-text("${documentType}")`,
    `label:has-text("${documentType}")`
  ]);

  if (!clickType.ok) {
    return { ok: false };
  }

  await targetPage.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => null);
  await sleep(1200);
  return { ok: true };
}

async function selectOptionByLabel(pageOrFrame, fieldSelectors, optionLabel) {
  for (const selector of fieldSelectors) {
    const count = await pageOrFrame.locator(selector).count().catch(() => 0);
    if (!count) {
      continue;
    }

    try {
      await pageOrFrame.locator(selector).first().selectOption({ label: optionLabel });
      return { ok: true, selector };
    } catch (_error) {
      continue;
    }
  }

  return { ok: false };
}

async function configureDocumentMetadata(targetPage, context, documentText) {
  const description = `Despacho ${context.input.processo}`;
  await fillFirstAvailable(targetPage, [
    'input[name*="NomeArvore" i]',
    'input[id*="NomeArvore" i]',
    'input[title*="Descricao" i]',
    'input[name*="descricao" i]'
  ], description);

  if (context.input.documentoModelo) {
    await selectOptionByLabel(targetPage, [
      'select[name*="TextoInicial" i]',
      'select[id*="TextoInicial" i]',
      'select[name*="TextoPadrao" i]',
      'select[id*="TextoPadrao" i]'
    ], "Documento Modelo");

    await fillFirstAvailable(targetPage, [
      'input[name*="DocumentoModelo" i]',
      'input[id*="DocumentoModelo" i]',
      'input[title*="Documento Modelo" i]',
      'input[placeholder*="Documento" i]'
    ], context.input.documentoModelo);
  } else {
    await selectOptionByLabel(targetPage, [
      'select[name*="TextoInicial" i]',
      'select[id*="TextoInicial" i]',
      'select[name*="TextoPadrao" i]',
      'select[id*="TextoPadrao" i]'
    ], "Nenhum").catch(() => null);
  }

  await clickFirstAvailable(targetPage, [
    'input[type="radio"][value="1"]',
    'label:has-text("Publico")',
    'label:has-text("Público")'
  ]).catch(() => null);

  const popupPromise = targetPage.context().waitForEvent("page", { timeout: 5000 }).catch(() => null);
  const confirmResult = await clickFirstAvailable(targetPage, [
    'button:has-text("Confirmar Dados")',
    'input[value*="Confirmar" i]',
    'button:has-text("Salvar")',
    'input[value*="Salvar" i]'
  ]);

  if (!confirmResult.ok) {
    return { ok: false };
  }

  const editorPage = await popupPromise;
  const targetEditor = editorPage || targetPage;
  await targetEditor.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => null);
  await sleep(1200);

  if (!context.input.documentoModelo) {
    const filled = await fillDocumentEditor(targetEditor, documentText);
    if (!filled.ok) {
      return {
        ok: false,
        editorPage: targetEditor,
        error: "editor-not-filled"
      };
    }
  }

  const saveResult = await clickFirstAvailable(targetEditor, [
    'button:has-text("Salvar")',
    'input[value="Salvar"]',
    'a[title*="Salvar" i]'
  ]);

  await sleep(1500);

  return {
    ok: true,
    editorPage: targetEditor,
    saveSelector: saveResult.selector || null
  };
}

async function fillDocumentEditor(editorPage, documentText) {
  const frames = editorPage.frames();

  for (const frame of frames) {
    try {
      const bodyCount = await frame.locator("body[contenteditable='true']").count().catch(() => 0);
      if (bodyCount) {
        const body = frame.locator("body[contenteditable='true']").first();
        await body.click({ timeout: 2000 });
        await body.press("ControlOrMeta+A", { timeout: 1000 }).catch(() => null);
        await body.fill(documentText, { timeout: 2000 });
        return { ok: true, selector: "body[contenteditable='true']" };
      }
    } catch (_error) {
      continue;
    }
  }

  const directFill = await fillFirstAvailable(editorPage, [
    "textarea",
    "body[contenteditable='true']",
    '[contenteditable="true"]'
  ], documentText);

  return directFill.ok ? directFill : { ok: false };
}

function printManualLoginInstructions(context, session) {
  console.log("");
  console.log("=== Gerar despacho no SEI ===");
  console.log(`Usuario ativo: ${context.user.displayName} (${context.user.id})`);
  console.log(`Unidade configurada: ${context.user.unit}`);
  console.log(`Navegador: ${session.executablePath}`);
  if (session.persistentSession && session.userDataDir) {
    console.log(`Perfil persistente: ${session.userDataDir}`);
  }
  console.log("");
  console.log("O navegador foi aberto para login manual.");
  console.log("Se o SEI pedir autenticacao em duas etapas (2FA), conclua essa etapa no navegador.");
  console.log("Depois de terminar o login e aguardar a tela principal carregar, volte e confirme.");
  console.log("");
}

async function saveLocalDraft(context, documentText) {
  const fileName = `${context.runId}.despacho.${sanitizeFileName(context.input.processo)}.md`;
  const outputPath = path.join(context.storage.outputsDir, fileName);
  fs.writeFileSync(outputPath, documentText, "utf8");
  return outputPath;
}

async function runFlow(context) {
  const processNumber = context.input.processo || "";
  const seiUrl = context.input.seiUrl || context.settings.sei?.baseUrl;
  const manualLogin =
    String(context.input.manualLogin || "").toLowerCase() === "true" ||
    String(context.input.manualLogin || "").toLowerCase() === "1" ||
    context.input.manualLogin === undefined;
  const documentType = context.input.tipoDocumento || "Despacho";
  const documentText = buildDispatchText(context);

  if (context.dryRun) {
    return {
      status: "dry-run",
      message: `Teste local concluido para gerar-despacho no processo ${processNumber || "nao informado"}.`
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

  if (!context.input.unidade) {
    throw new Error("Informe --input unidade=<nome da unidade>.");
  }

  if (!context.input.responsavel) {
    throw new Error("Informe --input responsavel=<nome do responsavel>.");
  }

  const localDraftPath = await saveLocalDraft(context, documentText);
  const session = await launchBrowser(context.settings, {
    userDataDir: context.storage.browserProfileDir
  });
  const { browser, executablePath } = session;

  let screenshotFile = null;
  let diagnosticsFile = null;

  try {
    reportProgress(context, "Abrindo o SEI para gerar o despacho.", {
      phase: "opening-browser",
      status: "running"
    });
    const page = browser.pages()[0] || (await browser.newPage());
    page.setDefaultNavigationTimeout(Number(context.settings.sei?.navigationTimeoutMs || 30000));
    await page.goto(seiUrl, { waitUntil: "domcontentloaded" });
    screenshotFile = await saveScreenshot(page, context, "despacho-sei-home");

    if (manualLogin) {
      printManualLoginInstructions(context, session);
      reportProgress(context, "Aguardando seu login no SEI.", {
        phase: "manual-login",
        status: "waiting-user",
        requiresConfirmation: true,
        confirmationLabel: "Ja conclui o login"
      });
      await waitForConfirmation(context, {
        type: "manual-login",
        title: "Concluir login no SEI",
        message:
          "Finalize o login no navegador e aguarde a tela principal carregar. Depois confirme para continuar.",
        question: "Pressione Enter para continuar apos concluir o login...",
        confirmLabel: "Ja conclui o login"
      });
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => null);
      await sleep(1500);
      screenshotFile = await saveScreenshot(page, context, "despacho-after-login");
    }

    reportProgress(context, `Abrindo o processo ${processNumber}.`, {
      phase: "open-process",
      status: "running"
    });
    const processResult = await openProcess(page, processNumber);
    if (!processResult.ok) {
      const diagnostics = await collectInputCandidates(page);
      diagnosticsFile = writeDiagnostics(context, diagnostics);
      return {
        status: "process-open-failed",
        message:
          `Nao consegui abrir o processo ${processNumber} no SEI para gerar o despacho. ` +
          `Rascunho local salvo em ${localDraftPath}. Diagnostico: ${diagnosticsFile}.`
      };
    }

    const processScreenshot = await saveScreenshot(page, context, "despacho-process-open");

    reportProgress(context, `Tentando incluir um novo documento do tipo ${documentType}.`, {
      phase: "create-document",
      status: "running"
    });
    const includeResult = await clickIncludeDocument(page);
    if (!includeResult.ok) {
      const diagnostics = await collectInputCandidates(page);
      diagnosticsFile = writeDiagnostics(context, diagnostics);
      return {
        status: "include-document-not-found",
        message:
          `O processo ${processNumber} foi aberto, mas nao encontrei a acao para incluir documento. ` +
          `Rascunho local salvo em ${localDraftPath}. Diagnostico: ${diagnosticsFile}. Screenshot: ${processScreenshot}.`
      };
    }

    const targetPage = includeResult.targetPage;
    const chooseType = await chooseDocumentType(targetPage, documentType);
    if (!chooseType.ok) {
      const diagnostics = await collectInputCandidates(targetPage);
      diagnosticsFile = writeDiagnostics(context, diagnostics);
      return {
        status: "document-type-not-found",
        message:
          `Nao consegui localizar o tipo de documento ${documentType} para o processo ${processNumber}. ` +
          `Rascunho local salvo em ${localDraftPath}. Diagnostico: ${diagnosticsFile}.`
      };
    }

    reportProgress(context, "Preenchendo os dados do novo documento.", {
      phase: "fill-document",
      status: "running"
    });
    const metadataResult = await configureDocumentMetadata(targetPage, context, documentText);
    const finalScreenshot = await saveScreenshot(targetPage, context, "despacho-final");

    if (!metadataResult.ok) {
      const diagnostics = await collectInputCandidates(targetPage);
      diagnosticsFile = writeDiagnostics(context, diagnostics);
      return {
        status: "document-fill-failed",
        message:
          `Abri o fluxo de criacao do documento, mas nao consegui concluir o preenchimento no SEI. ` +
          `Rascunho local salvo em ${localDraftPath}. Diagnostico: ${diagnosticsFile}. Screenshot: ${finalScreenshot}.`
      };
    }

    return {
      status: "document-created-in-sei",
      message:
        `Despacho criado para o processo ${processNumber}. ` +
        `Tipo de documento: ${documentType}. ` +
        `Documento modelo: ${context.input.documentoModelo || "nao utilizado"}. ` +
        `Navegador: ${executablePath}. Screenshots: ${screenshotFile}, ${processScreenshot}, ${finalScreenshot}. ` +
        `Rascunho local salvo em ${localDraftPath}.`
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  runFlow
};
