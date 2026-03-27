const { ask } = require("../../runner/prompt");

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

function printManualLoginInstructions(context, session) {
  console.log("");
  console.log("=== Autenticacao no SEI - J.Flow ===");
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

module.exports = {
  sleep,
  sanitizeFileName,
  reportProgress,
  waitForConfirmation,
  printManualLoginInstructions
};
