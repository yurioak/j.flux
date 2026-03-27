const { sleep } = require("./core");

/**
 * Verifica se o usuário já está logado no SEI.
 * Faz uma varredura em busca de elementos característicos da UI logada.
 */
async function checkLoginStatus(page, skipRedirect = false) {
  // Espera curta para garantir que o DOM básico carregou
  await page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => null);
  await sleep(1000); 

  const currentUrl = page.url();

  // Se a URL indica explicitamente a tela de login unificada (SIP) ou acao=login
  const isLoginPage = currentUrl.includes("sip/login.php") || 
                     currentUrl.includes("acao=login") || 
                     currentUrl.includes("acao=usuario_login");

  if (isLoginPage && !skipRedirect) {
    const hasCookies = (await page.context().cookies()).length > 0;
    if (hasCookies) {
      console.log("[JFlow] Detectada pagina de login com cookies. Tentando auto-login...");
      const principalUrl = currentUrl.replace(/acao=(login|usuario_login)/, "acao=principal");
      if (principalUrl !== currentUrl) {
         await page.goto(principalUrl, { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => null);
         return await checkLoginStatus(page, true);
      }
    }
    return { isLogged: false };
  }

  // Indicadores INQUESTIONÁVEIS de que estamos dentro do sistema logado
  const strongIndicators = [
    '#txtPesquisaRapida',    // Campo de pesquisa rápida (barra superior)
    '#selInfraUnidadeActual', // Seletor de unidade ativa
    '#divArvoreAcoes',       // Barra de ferramentas de um processo aberto
    'a[href*="acao=usuario_logout"]', // Link Real de Sair (SIP ou SEI)
    '#ifrArvore',             // Frame da árvore lateral
    '#ifrVisualizacao'        // Frame de conteúdo
  ];

  for (const selector of strongIndicators) {
    const found = await page.locator(selector).count().catch(() => 0);
    if (found > 0) return { isLogged: true, source: `indicator:${selector}` };
  }

  // Busca nos frames caso o SEI esteja encapsulado
  const frames = page.frames();
  for (const frame of frames) {
    if (frame === page.mainFrame()) continue;
    for (const selector of strongIndicators) {
      try {
        const found = await frame.locator(selector).count().catch(() => 0);
        if (found > 0) return { isLogged: true, source: `frame:${frame.name() || "unnamed"}`, selector };
      } catch (e) { }
    }
  }

  // Checagem final por conteúdo se a URL parecer correta
  if (!isLoginPage && currentUrl.includes("controlador.php")) {
     const hasSearch = await page.getByRole('textbox', { name: /Pesquisa Rápida/i }).count().catch(() => 0);
     if (hasSearch > 0) return { isLogged: true, source: "accessible-search" };
  }

  return { isLogged: false };
}

module.exports = {
  checkLoginStatus
};
