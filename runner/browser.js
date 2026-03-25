const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const candidateExecutables = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];

function resolveExecutablePath(settings) {
  const configured = settings.browser?.executablePath;
  if (configured && fs.existsSync(configured)) {
    return configured;
  }

  return candidateExecutables.find((candidate) => fs.existsSync(candidate)) ?? null;
}

async function launchBrowser(settings, options = {}) {
  const executablePath = resolveExecutablePath(settings);

  if (!executablePath) {
    throw new Error(
      "Nenhum navegador suportado foi encontrado. Ajuste browser.executablePath em config/settings.json."
    );
  }

  const launchOptions = {
    executablePath,
    headless: Boolean(settings.browser?.headless),
    slowMo: Number(settings.browser?.slowMo || 0)
  };

  const usePersistentSession = settings.browser?.persistentSession !== false;
  const userDataDir =
    settings.browser?.userDataDir ||
    options.userDataDir ||
    path.join(process.cwd(), ".browser-profile");

  if (usePersistentSession) {
    const browser = await chromium.launchPersistentContext(userDataDir, launchOptions);
    return {
      browser,
      executablePath,
      userDataDir,
      persistentSession: true
    };
  }

  const browser = await chromium.launch(launchOptions);

  return {
    browser,
    executablePath,
    userDataDir: null,
    persistentSession: false
  };
}

module.exports = {
  launchBrowser,
  resolveExecutablePath
};
