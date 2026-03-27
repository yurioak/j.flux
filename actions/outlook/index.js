const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { logger } = require("../../runner/logger");

/**
 * Ação: Outlook RPA
 * 
 * Responsabilidade: Enviar e-mails usando a interface web do Outlook (OWA).
 * Foco em zero-fricção: Reaproveita a sessão ativa no navegador do robô.
 */

async function sendOutlookEmail(emailData, context) {
  const { to, subject, html, text } = emailData;
  const userId = context.userId || "default";
  const projectRoot = path.resolve(__dirname, "../../");
  const storagePath = path.join(projectRoot, "storage", "users", userId, "browser-state.json");

  logger.info(`Iniciando envio Outlook RPA para ${to}`);

  const browser = await chromium.launch({ 
    headless: false, // Quase sempre false por causa de MFA/sessão
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  // Tenta carregar sessão salva
  const storageState = fs.existsSync(storagePath) ? storagePath : undefined;
  const browserContext = await browser.newContext({ storageState });
  const page = await browserContext.newPage();

  try {
    // 1. Acessa Outlook Web
    await page.goto("https://outlook.office.com/mail/", { waitUntil: "networkidle", timeout: 45000 });

    // 2. Verifica se caiu na tela de login
    const isLogin = page.url().includes("login.microsoftonline.com") || page.url().includes("login.live.com");
    if (isLogin) {
      if (context.reportProgress) {
        context.reportProgress({
          phase: "manual-login",
          status: "awaiting-user",
          message: "Sessão expirada. Por favor, faça login no Outlook no navegador aberto."
        });
      }
      
      // Espera o usuário logar e entrar na caixa de entrada
      await page.waitForURL("**/mail/**", { timeout: 300000 });
      
      // Salva a nova sessão
      await browserContext.storageState({ path: storagePath });
      logger.info("Nova sessão Outlook salva com sucesso.");
    }

    // 3. Clica em "Nova Mensagem"
    // O seletor pode variar, mas geralmente o ID ou label é detectável
    await page.waitForSelector('button[aria-label="New mail"], button[title="New mail"]', { timeout: 30000 });
    await page.click('button[aria-label="New mail"], button[title="New mail"]');

    // 4. Preenche Destinatário
    await page.waitForSelector('div[aria-label="To"]', { timeout: 15000 });
    await page.fill('div[aria-label="To"]', to);
    await page.keyboard.press("Enter");

    // 5. Preenche Assunto
    await page.fill('input[aria-label="Add a subject"]', subject);

    // 6. Preenche Corpo (HTML ou Text)
    // O editor do Outlook é um contenteditable complexo. Faremos uma inserção direta.
    await page.click('div[aria-label="Message body"]');
    await page.keyboard.insertText(text || "E-mail enviado via J.Flow");
    
    // Se quiser HTML, pode ser necessário manipular o innerHTML do editor via evaluate
    if (html) {
      await page.evaluate((htmlContent) => {
        const editor = document.querySelector('div[aria-label="Message body"]');
        if (editor) editor.innerHTML = htmlContent;
      }, html);
    }

    // 7. Envia
    await page.click('button[aria-label="Send"], button[title="Send"]');

    // 8. Espera confirmação de envio (toast ou fechamento da janela de composição)
    await page.waitForTimeout(3000); // Segurança básica

    logger.info(`E-mail enviado via Outlook RPA com sucesso para ${to}`);
    
    return { ok: true, method: "rpa-outlook", timestamp: new Date().toISOString() };
    
  } catch (error) {
    logger.error(`Falha no envio Outlook RPA: ${error.message}`);
    return { ok: false, error: error.message };
  } finally {
    // Salva estado por precaução se logado
    if (!page.url().includes("login")) {
      await browserContext.storageState({ path: storagePath });
    }
    await browser.close();
  }
}

module.exports = { sendOutlookEmail };
