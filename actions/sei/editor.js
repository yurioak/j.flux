const { fillFirstAvailable } = require("./frames");

async function fillDocumentEditor(editorPage, documentText) {
  const frames = editorPage.frames();

  for (let attempt = 0; attempt < 5; attempt++) {
    const frames = editorPage.frames();
    
    for (const frame of frames) {
      try {
        const bodyCount = await frame.locator("body[contenteditable='true']").count().catch(() => 0);
        if (bodyCount) {
          const body = frame.locator("body[contenteditable='true']").first();
          await body.click({ timeout: 2000 });
          await body.press("ControlOrMeta+A", { timeout: 1000 }).catch(() => null);
          
          await body.fill(documentText, { timeout: 2000 });
          return { ok: true, selector: "body[contenteditable='true']", type: "iframe" };
        }
      } catch (_error) {
        continue;
      }
    }
    
    // Se não encontrou, talvez o CKEditor ainda esteja carregando o JS do IFrame.
    await new Promise(r => setTimeout(r, 2000));
  }

  const directFill = await fillFirstAvailable(editorPage, [
    "textarea",
    "body[contenteditable='true']",
    '[contenteditable="true"]'
  ], documentText);

  return directFill.ok ? directFill : { ok: false };
}

module.exports = {
  fillDocumentEditor
};
