const { sleep } = require("./core");
const { 
  clickFirstAvailable, 
  clickFirstAvailableInFrames, 
  fillFirstAvailable, 
  fillFirstAvailableInFrames, 
  selectOptionByLabel, 
  selectOptionByLabelInFrames 
} = require("./frames");

async function clickIncludeDocument(page) {
  const strictIncludeSelectors = [
    '#divArvoreAcoes a[title*="Incluir Documento" i]',
    '#divArvoreAcoes img[title*="Incluir Documento" i]',
    '#divArvoreAcoes a[href*="documento_gerar" i]',
    '#divArvoreAcoes img[src*="documento_gerar.gif"]',
    '#divComandos a[title*="Incluir" i]',
    '#divComandos a[href*="documento_gerar" i]'
  ];

  let popupPromise = page.context().waitForEvent("page", { timeout: 8000 }).catch(() => null);

  let clickResult = await clickFirstAvailableInFrames(page, strictIncludeSelectors);

  if (!clickResult.ok) {
    console.log("Botao Incluir nao encontrado. Verificando se o processo precisa ser atribuido...");
    const assignSelectors = [
      '#divArvoreAcoes a[href*="atribuir_processo" i]',
      '#divArvoreAcoes img[src*="atribuir_processo"]',
      'img[src*="atribuir_processo"]'
    ];
    
    const assignResult = await clickFirstAvailableInFrames(page, assignSelectors);
    
    if (assignResult.ok) {
       console.log("Clique em Atribuir detectado. Aguardando recarregamento da barra de botoes...");
       await sleep(3000); 
       popupPromise = page.context().waitForEvent("page", { timeout: 8000 }).catch(() => null);
       clickResult = await clickFirstAvailableInFrames(page, strictIncludeSelectors);
    }
  }

  if (!clickResult.ok) {
    const directResult = await clickFirstAvailable(page, strictIncludeSelectors);
    if (!directResult.ok) {
      console.log("Erro de permissao: O botao 'Incluir Documento' nao esta disponivel.");
      return { ok: false, error: "processo-restrito-fora-da-unidade" };
    }
  }

  const popup = await popupPromise;
  const targetPage = popup || page;
  await targetPage.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => null);
  await sleep(600);

  return {
    ok: true,
    targetPage,
    selector: clickResult.selector || "frame-search"
  };
}

async function chooseDocumentType(targetPage, documentType) {
  const expandResult = await clickFirstAvailableInFrames(targetPage, [
    'a[title*="Exibir todos os tipos" i]',
    'button:has-text("Exibir todos os tipos")',
    'a:has-text("Exibir todos os tipos")',
    '#lnkInfraExibirTodos'
  ]);
  
  if (!expandResult.ok) {
    await clickFirstAvailable(targetPage, [
      'a[title*="Exibir todos os tipos" i]',
      'button:has-text("Exibir todos os tipos")',
      'a:has-text("Exibir todos os tipos")',
      '#lnkInfraExibirTodos'
    ]);
  }

  await sleep(400);

  const filterResult = await fillFirstAvailableInFrames(targetPage, [
    '#txtFiltro',
    'input#txtFiltro',
    'input[placeholder*="filtrar" i]'
  ], documentType);
  
  if (!filterResult.ok) {
    await fillFirstAvailable(targetPage, [
      '#txtFiltro',
      'input#txtFiltro'
    ], documentType);
  }

  await sleep(400);

  const clickType = await clickFirstAvailableInFrames(targetPage, [
    `#divTipoDocumento a:has-text("${documentType}")`,
    `table a:has-text("${documentType}")`,
    `#selTipoDocumento option:has-text("${documentType}")`,
    `a:has-text("${documentType}")`
  ]);

  if (!clickType.ok) {
    const directClick = await clickFirstAvailable(targetPage, [
      `#divTipoDocumento a:has-text("${documentType}")`,
      `a:has-text("${documentType}")`
    ]);
    if (!directClick.ok) return { ok: false };
  }

  await targetPage.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => null);
  await sleep(500);
  return { ok: true };
}

async function configureDocumentMetadata(targetPage, context, documentText, documentType, injectEditorFn = null) {
  const now = new Date();
  const timestamp = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const description = `${documentType} JFlow ${timestamp}`;

  // Adicionar listener de dialogo para aceitar alertas do SEI (ex: "Documento ja existe")
  const dialogHandler = async dialog => {
    console.log(`[JFlow:SEI] Dialogo detectado: ${dialog.message()}`);
    await dialog.accept().catch(() => null);
  };
  targetPage.on('dialog', dialogHandler);

  await targetPage.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => null);
  await sleep(500);

  const descSelectors = [
    '#txtDescricao',
    '#txtDescricaoBusca',
    'input[name*="NomeArvore" i]',
    'input[id*="NomeArvore" i]',
    'input[id*="txtDescricao" i]',
    'input[title*="Descricao" i]'
  ];
  await fillFirstAvailableInFrames(targetPage, descSelectors, description);

  const textoInicialSelectors = [
    'select[name*="TextoInicial" i]',
    'select[id*="selTextoPadrao" i]',
    'select[id*="TextoInicial" i]',
    'select[name*="TextoPadrao" i]',
    'select[id*="TextoPadrao" i]'
  ];

  if (context.input.documentoModelo) {
    await selectOptionByLabelInFrames(targetPage, textoInicialSelectors, "Documento Modelo");
    await sleep(500);
    await fillFirstAvailableInFrames(targetPage, [
      'input[name*="DocumentoModelo" i]',
      'input[id*="DocumentoModelo" i]',
      'input[id*="txtDocumentoModelo" i]',
      'input[title*="Documento Modelo" i]',
      'input[placeholder*="Documento" i]'
    ], context.input.documentoModelo);
  } else {
    await selectOptionByLabelInFrames(targetPage, textoInicialSelectors, "Nenhum").catch(() => null);
    await selectOptionByLabel(targetPage, textoInicialSelectors, "Nenhum").catch(() => null);
  }

  const publicoSelectors = [
    '#optPublico',
    'input[type="radio"][value="0"]',
    'input[type="radio"][id*="Publico" i]',
    'input[type="radio"][value="1"]',
    'label:has-text("Publico")',
    'label:has-text("Público")'
  ];
  await clickFirstAvailableInFrames(targetPage, publicoSelectors).catch(() => null);
  await sleep(400);

  const confirmSelectors = [
    '#btnSalvar',
    'button[id*="btnSalvar" i]',
    'button:has-text("Confirmar Dados")',
    'input[value*="Confirmar" i]',
    'button:has-text("Confirmar")',
    'button:has-text("Salvar")',
    'input[value*="Salvar" i]',
    'input[type="submit"]'
  ];

  const popupPromise = targetPage.context().waitForEvent("page", { timeout: 10000 }).catch(() => null);

  let confirmResult = await clickFirstAvailableInFrames(targetPage, confirmSelectors);
  if (!confirmResult.ok) {
    confirmResult = await clickFirstAvailable(targetPage, confirmSelectors);
  }

  if (!confirmResult.ok) {
    console.log("Nao encontrou botao de confirmar/salvar");
    return { ok: false, error: "confirm-button-not-found" };
  }

  const editorPage = await popupPromise;
  const targetEditor = editorPage || targetPage;
  
  if (editorPage) {
    await targetEditor.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => null);
    await sleep(3000);
  }

  if (!context.input.documentoModelo && documentText && injectEditorFn) {
    const filled = await injectEditorFn(targetEditor, documentText);
    
    if (filled.ok) {
      const saveSelectors = [
        '#btnSalvar',
        'button:has-text("Salvar")',
        'input[value="Salvar"]',
        'a[title*="Salvar" i]',
        'button[id*="btnSalvar" i]'
      ];

      let saveResult = await clickFirstAvailableInFrames(targetEditor, saveSelectors);
      if (!saveResult.ok) {
        saveResult = await clickFirstAvailable(targetEditor, saveSelectors);
      }
      await sleep(1000);
      
      if (editorPage) {
        // Remover listener antes de fechar para nao vazar
        targetPage.off('dialog', dialogHandler);
        await editorPage.close().catch(() => null);
      }
    }
  }

  return {
    ok: true,
    editorPage: targetEditor
  };
}

module.exports = {
  clickIncludeDocument,
  chooseDocumentType,
  configureDocumentMetadata
};
