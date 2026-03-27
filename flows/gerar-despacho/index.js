const fs = require("fs");
const path = require("path");
const { launchBrowser } = require("../../runner/browser");
const { saveScreenshot } = require("../../runner/screenshot");
const { collectInputCandidates, writeDiagnostics } = require("../../runner/page-diagnostics");

// Importando todas as acoes atomicas do Adaptador SEI (Clean Architecture)
const sei = require("../../actions/sei");

function renderTemplate(context, templateName) {
  const templatePath = path.join(__dirname, "templates", `${templateName}.md`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template J.Flow nao encontrado: ${templatePath}`);
  }
  
  let content = fs.readFileSync(templatePath, "utf8");
  
  // Engine simples de substituicao {{variavel}} (Baixa a fricção de bibliotecas externas)
  const vars = {
    processo: context.input.processo || "nao informado",
    unidade: context.input.unidade || "nao informada",
    responsavel: context.input.responsavel || "nao informado",
    resumo: context.input.resumo || "Sem resumo adicional informado.",
    data: new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(new Date())
  };

  for (const [key, value] of Object.entries(vars)) {
    content = content.replace(new RegExp(`{{${key}}}`, "g"), value);
  }

  return content;
}

async function saveLocalDraft(context, documentText) {
  const fileName = `${context.runId}.despacho.${sei.sanitizeFileName(context.input.processo)}.md`;
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
  const templateId = context.input.template || "padrao";
  const documentText = renderTemplate(context, templateId);

  if (context.dryRun) {
    return {
      status: "dry-run",
      message: `Teste local concluido para gerar-despacho no processo ${processNumber || "nao informado"}.`
    };
  }

  if (!seiUrl || seiUrl === "https://SEU-SEI-AQUI") {
    throw new Error("Configure a URL do SEI em config/settings.base.json ou no perfil do usuario.");
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
  const { browser } = session;

  let screenshotFile = null;
  let diagnosticsFile = null;

  try {
    sei.reportProgress(context, "Abrindo o SEI para gerar o despacho.", { phase: "opening-browser", status: "running" });
    const page = browser.pages()[0] || (await browser.newPage());
    page.setDefaultNavigationTimeout(Number(context.settings.sei?.navigationTimeoutMs || 15000));
    await page.goto(seiUrl, { waitUntil: "domcontentloaded" });
    screenshotFile = await saveScreenshot(page, context, "despacho-sei-home");

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
        sei.reportProgress(context, "Aguardando seu login no SEI.", {
          phase: "manual-login", status: "waiting-user", requiresConfirmation: true, confirmationLabel: "Ja conclui o login"
        });
        await sei.waitForConfirmation(context, {
          type: "manual-login", title: "Concluir login no SEI", message: "Finalize o login no navegador e retorne.", confirmLabel: "Ja conclui o login"
        });
        
        // Retomada Robusta: Espera a página se estabilizar após a volta do usuário
        sei.reportProgress(context, "Retomando automação após seu login...", { phase: "manual-login", status: "running" });
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => null);
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => null);
        await sleep(1500);
      }
      screenshotFile = await saveScreenshot(page, context, "despacho-after-login");
    }

    sei.reportProgress(context, `Abrindo o processo ${processNumber}.`, { phase: "open-process", status: "running" });
    
    // ACAO: ABRE O PROCESSO
    const processResult = await sei.openProcess(page, processNumber);
    if (!processResult.ok) {
      diagnosticsFile = writeDiagnostics(context, await collectInputCandidates(page));
      return {
        status: "process-open-failed",
        message: `Nao consegui abrir o processo ${processNumber}. Diagnostico: ${diagnosticsFile}.`
      };
    }

    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => null);
    const processScreenshot = await saveScreenshot(page, context, "despacho-process-open");

    // Lembrete da arvore antiga para inteligencia
    const initialTreeState = await sei.getTreeState(page);

    sei.reportProgress(context, `Incluindo novo documento tipo ${documentType}...`, { phase: "create-document", status: "running" });
    
    // ACAO: INCLUIR DOCUMENTO (STRICT SELECTORS DA FASE 1 JÁ APLICADOS AQUI NA ACTION)
    const includeResult = await sei.clickIncludeDocument(page);
    if (!includeResult.ok) {
      if (includeResult.error === "processo-restrito-fora-da-unidade") {
        return {
          status: "process-restricted",
          message: `Nao e possivel gerar documento: O processo ${processNumber} nao esta atribuido a voce e o SEI nao permitiu abri-lo automaticamente.`
        };
      }
      return {
        status: "include-document-not-found",
        message: `O processo ${processNumber} foi aberto, mas nao encontrei a acao para incluir documento. Screenshot: ${processScreenshot}.`
      };
    }

    // ACAO: TIPO DO DOCUMENTO
    const targetPage = includeResult.targetPage;
    await sei.chooseDocumentType(targetPage, documentType);

    sei.reportProgress(context, "Preenchendo os dados do novo documento.", { phase: "fill-document", status: "running" });
    
    // ACAO: METADADOS E INJEÇÃO NO EDITOR
    const metadataResult = await sei.configureDocumentMetadata(targetPage, context, documentText, documentType, sei.fillDocumentEditor);

    sei.reportProgress(context, "Finalizando o processo e verificando resultado.", { phase: "finish", status: "running" });
    const finalScreenshot = await saveScreenshot(page, context, "despacho-final");
    
    // ACAO: CHECAGEM INTELIGENTE
    const shortId = context.runId.substring(0, 8);
    const treeCheck = await sei.checkDocumentInTree(page, processNumber, `${documentType} ${shortId}`, initialTreeState);

    if (!metadataResult.ok && !treeCheck.ok) {
      return {
        status: "document-fill-failed",
        message: `Falha na criacao. Verificado na arvore: ${treeCheck.ok}. Rascunho local: ${localDraftPath}. Screenshot: ${finalScreenshot}.`
      };
    }

    return {
      status: "document-created-in-sei",
      message: `Despacho criado com sucesso para o processo ${processNumber}${treeCheck.ok ? ` (verificado: ${treeCheck.source})` : ""}. Screenshot: ${finalScreenshot}.`
    };
  } catch (error) {
    // Captura o estado final em caso de erro para diagnóstico durável
    diagnosticsFile = writeDiagnostics(context, await collectInputCandidates(page).catch(() => []));
    throw error; // Re-lança para o runner tratar e gravar no log
  } finally {
    if (browser) await browser.close().catch(() => null);
  }
}

module.exports = { runFlow };
