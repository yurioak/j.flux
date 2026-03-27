const fs = require("fs");
const path = require("path");
const { loadSettings, projectRoot } = require("./config");
const { findFlowById } = require("./flow-loader");
const { ensureStorage, writeRunLog, writeRunOutput } = require("./storage");
const { logger } = require("./logger");

function buildRunId() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `run-${stamp}`;
}

async function runFlowById(flowId, executionOptions = {}) {
  const settings = loadSettings(executionOptions.userId || "default");
  ensureStorage(settings);

  const flow = findFlowById(flowId, settings);

  if (!flow) {
    throw new Error(`Fluxo nao encontrado: ${flowId}`);
  }

  const entryPath = path.join(flow.path, "index.js");
  if (!fs.existsSync(entryPath)) {
    throw new Error(`Arquivo de execucao nao encontrado: ${entryPath}`);
  }

  const flowModule = require(entryPath);
  if (typeof flowModule.runFlow !== "function") {
    throw new Error(`O fluxo ${flowId} nao exporta runFlow(context).`);
  }

  const runId = executionOptions.runId || buildRunId();
  const context = {
    runId,
    flow,
    input: executionOptions.input || {},
    dryRun: Boolean(executionOptions.dryRun),
    settings,
    projectRoot,
    user: settings.user,
    storage: {
      rootDir: path.resolve(projectRoot, settings.storage.rootDir, settings.storage.subdir),
      logsDir: path.resolve(
        projectRoot,
        settings.storage.rootDir,
        settings.storage.subdir,
        settings.storage.logsDirName
      ),
      screenshotsDir: path.resolve(
        projectRoot,
        settings.storage.rootDir,
        settings.storage.subdir,
        settings.storage.screenshotsDirName
      ),
      outputsDir: path.resolve(
        projectRoot,
        settings.storage.rootDir,
        settings.storage.subdir,
        settings.storage.outputsDirName
      ),
      exportsDir: path.resolve(
        projectRoot,
        settings.storage.rootDir,
        settings.storage.subdir,
        settings.storage.exportsDirName
      ),
      templatesDir: path.resolve(
        projectRoot,
        settings.storage.rootDir,
        settings.storage.subdir,
        settings.storage.templatesDirName
      ),
      browserProfileDir: path.resolve(
        projectRoot,
        settings.storage.rootDir,
        settings.storage.subdir,
        settings.storage.browserProfilesDirName || "browser-profile"
      )
    },
    reportProgress(progress) {
      if (typeof executionOptions.onProgress === "function") {
        executionOptions.onProgress({
          runId,
          flowId,
          ...progress
        });
      }
    },
    waitForUserConfirmation(payload) {
      if (typeof executionOptions.waitForUserConfirmation === "function") {
        return executionOptions.waitForUserConfirmation({
          runId,
          flowId,
          ...payload
        });
      }

      return null;
    }
  };

  if (typeof executionOptions.onRunStart === "function") {
    executionOptions.onRunStart({
      runId,
      flow: {
        id: flow.id,
        name: flow.name,
        version: flow.version
      },
      user: context.user,
      input: context.input
    });
  }

  const startedAt = new Date().toISOString();
  let result;
  let errorOccurred = false;

  try {
    result = await flowModule.runFlow(context);
  } catch (err) {
    logger.error(`Erro fatal no fluxo ${flowId}: ${err.message}`, { stack: err.stack });
    result = {
      status: "error",
      message: `Erro inesperado: ${err.message}`
    };
    errorOccurred = true;
  }

  const finishedAt = new Date().toISOString();

  const finalResult = {
    runId,
    flow: {
      id: flow.id,
      name: flow.name,
      version: flow.version
    },
    status: result.status || "unknown",
    message: result.message || "Fluxo executado.",
    startedAt,
    finishedAt,
    input: context.input,
    user: context.user
  };

  // Garante durabilidade: Sempre escreve o log, mesmo em erro
  const logFile = writeRunLog(context, finalResult);
  const outputFile = writeRunOutput(context, finalResult);

  return {
    ...finalResult,
    logFile,
    outputFile,
    error: errorOccurred ? finalResult.message : null
  };
}

module.exports = {
  runFlowById
};
