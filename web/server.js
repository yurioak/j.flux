const fs = require("fs");
const http = require("http");
const path = require("path");
const { bootstrapRunner } = require("../runner/app");
const { listUserProfiles, loadSettings, projectRoot } = require("../runner/config");
const { runFlowById } = require("../runner/flow-runner");

const host = "0.0.0.0";
const port = Number(process.env.PORT || 4317);
const webRoot = path.join(projectRoot, "web");
const activeRuns = new Map();
const flowLibraryPath = path.join(projectRoot, "config", "flow-library.json");

function buildRunId() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `run-${stamp}`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, statusCode, payload, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  response.end(payload);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("JSON invalido no corpo da requisicao."));
      }
    });

    request.on("error", reject);
  });
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

function loadFlowLibrary() {
  return (
    safeReadJson(flowLibraryPath) || {
      installed: [],
      inDevelopment: []
    }
  );
}

function getUserStorageRoot(userId) {
  const settings = loadSettings(userId);
  return path.resolve(projectRoot, settings.storage.rootDir, settings.storage.subdir);
}

function listStoredRuns(userId) {
  const storageRoot = getUserStorageRoot(userId);
  const outputsDir = path.join(storageRoot, "outputs");
  const logsDir = path.join(storageRoot, "logs");

  if (!fs.existsSync(outputsDir)) {
    return [];
  }

  return fs
    .readdirSync(outputsDir)
    .filter((fileName) => fileName.endsWith(".result.json"))
    .map((fileName) => {
      const resultFile = path.join(outputsDir, fileName);
      const payload = safeReadJson(resultFile);

      if (!payload) {
        return null;
      }

      return {
        ...payload,
        source: "storage",
        logFile: path.join(logsDir, `${payload.runId}.log.json`),
        outputFile: resultFile
      };
    })
    .filter(Boolean)
    .sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)));
}

function getRunSummary(record) {
  return {
    runId: record.runId,
    flow: record.flow,
    user: record.user,
    status: record.status,
    message: record.message,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt || null,
    source: record.source || "memory",
    awaitingConfirmation: record.awaitingConfirmation || null,
    lastProgress: record.progressEvents?.[record.progressEvents.length - 1] || null
  };
}

function listRuns(userId) {
  const persisted = listStoredRuns(userId);
  const active = Array.from(activeRuns.values())
    .filter((run) => run.user.id === userId)
    .map((run) => ({
      runId: run.runId,
      flow: run.flow,
      user: run.user,
      status: run.status,
      message: run.message,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      source: "memory",
      awaitingConfirmation: run.awaitingConfirmation,
      progressEvents: run.progressEvents
    }));

  const merged = new Map();
  [...persisted, ...active].forEach((record) => {
    merged.set(record.runId, record);
  });

  return Array.from(merged.values())
    .sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)))
    .slice(0, 20)
    .map(getRunSummary);
}

function getRun(runId, userId) {
  const active = activeRuns.get(runId);
  if (active && active.user.id === userId) {
    return {
      runId: active.runId,
      flow: active.flow,
      user: active.user,
      status: active.status,
      message: active.message,
      startedAt: active.startedAt,
      finishedAt: active.finishedAt,
      input: active.input,
      source: "memory",
      awaitingConfirmation: active.awaitingConfirmation,
      progressEvents: active.progressEvents,
      result: active.result || null,
      error: active.error || null
    };
  }

  const persisted = listStoredRuns(userId).find((item) => item.runId === runId);
  if (!persisted) {
    return null;
  }

  return {
    ...persisted,
    awaitingConfirmation: null,
    progressEvents: []
  };
}

function guessOpenMessage(flowId) {
  if (flowId === "consultar-processo") {
    return "O navegador do SEI sera aberto. Se houver login manual ou 2FA, conclua essa etapa no navegador e depois confirme na tela.";
  }

  return "A execucao sera iniciada no runner local.";
}

function normalizeInput(input) {
  const normalized = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    normalized[key] = String(value);
  });
  return normalized;
}

function startRun({ userId, flowId, input }) {
  const runId = buildRunId();
  const runRecord = {
    runId,
    flow: null,
    user: { id: userId },
    input,
    status: "queued",
    message: "Execucao enfileirada.",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    progressEvents: [],
    awaitingConfirmation: null,
    result: null,
    error: null,
    confirmResolver: null
  };
  activeRuns.set(runId, runRecord);

  const execution = runFlowById(flowId, {
    runId,
    userId,
    input,
    onRunStart(payload) {
      runRecord.runId = payload.runId;
      runRecord.flow = payload.flow;
      runRecord.user = payload.user;
      runRecord.input = payload.input;
      runRecord.status = "running";
      runRecord.message = guessOpenMessage(flowId);
      runRecord.startedAt = new Date().toISOString();
    },
    onProgress(progress) {
      runRecord.progressEvents.push({
        timestamp: new Date().toISOString(),
        ...progress
      });
      runRecord.status = progress.status || runRecord.status;
      runRecord.message = progress.message || runRecord.message;
      if (progress.requiresConfirmation) {
        runRecord.awaitingConfirmation = {
          type: progress.phase || "confirmation",
          label: progress.confirmationLabel || "Continuar execucao"
        };
      }
    },
    waitForUserConfirmation(payload) {
      runRecord.status = "awaiting-user";
      runRecord.message = payload.message || "Aguardando confirmacao do usuario.";
      runRecord.awaitingConfirmation = {
        type: payload.type || "confirmation",
        title: payload.title || "Confirmacao necessaria",
        message: payload.message || "",
        label: payload.confirmLabel || "Continuar"
      };

      return new Promise((resolve) => {
        runRecord.confirmResolver = resolve;
      });
    }
  });

  execution
    .then((result) => {
      runRecord.status = result.status;
      runRecord.message = result.message;
      runRecord.finishedAt = result.finishedAt;
      runRecord.result = result;
      runRecord.awaitingConfirmation = null;
      runRecord.confirmResolver = null;
    })
    .catch((error) => {
      runRecord.status = "error";
      runRecord.message = error.message;
      runRecord.finishedAt = new Date().toISOString();
      runRecord.error = {
        message: error.message
      };
      runRecord.awaitingConfirmation = null;
      runRecord.confirmResolver = null;
    });

  return runRecord;
}

function serveStaticFile(requestPath, response) {
  const requested = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.resolve(webRoot, `.${requested}`);

  if (!filePath.startsWith(webRoot) || !fs.existsSync(filePath)) {
    sendText(response, 404, "Arquivo nao encontrado.");
    return;
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
  };

  sendText(
    response,
    200,
    fs.readFileSync(filePath),
    contentTypes[ext] || "application/octet-stream"
  );
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/users") {
    const users = listUserProfiles().map((userId) => {
      const settings = loadSettings(userId);
      return {
        id: userId,
        displayName: settings.user.displayName,
        unit: settings.user.unit
      };
    });

    sendJson(response, 200, {
      users,
      defaultUserId: users[0]?.id || "default"
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/flows") {
    const userId = url.searchParams.get("userId") || "default";
    const state = bootstrapRunner(userId);
    const library = loadFlowLibrary();
    const flows = state.flows.map((flow) => ({
      id: flow.id,
      name: flow.name,
      version: flow.version,
      description: flow.manifest.description || "",
      tags: flow.manifest.tags || [],
      inputs: flow.manifest.inputs || [],
      library:
        library.installed.find((item) => item.id === flow.id) || {
          status: "available",
          headline: flow.manifest.description || flow.name,
          summary: flow.manifest.description || "",
          category: "Fluxo"
        }
    }));

    sendJson(response, 200, {
      appName: state.appName,
      user: state.user,
      flows,
      library
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/runs") {
    const userId = url.searchParams.get("userId") || "default";
    sendJson(response, 200, {
      runs: listRuns(userId)
    });
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/runs/")) {
    const userId = url.searchParams.get("userId") || "default";
    const runId = url.pathname.split("/")[3];
    const run = getRun(runId, userId);

    if (!run) {
      sendJson(response, 404, { error: "Execucao nao encontrada." });
      return;
    }

    sendJson(response, 200, run);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/runs") {
    const body = await readRequestBody(request);
    const userId = body.userId || "default";
    const flowId = body.flowId;
    const input = normalizeInput(body.input);

    if (!flowId) {
      sendJson(response, 400, { error: "Informe flowId." });
      return;
    }

    const run = startRun({ userId, flowId, input });
    sendJson(response, 202, {
      accepted: true,
      pending: true,
      userId,
      flowId,
      runId: run.runId,
      message: "Execucao iniciada no runner local."
    });
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname.startsWith("/api/runs/") &&
    url.pathname.endsWith("/continue")
  ) {
    const runId = url.pathname.split("/")[3];
    const run = activeRuns.get(runId);

    if (!run) {
      sendJson(response, 404, { error: "Execucao ativa nao encontrada." });
      return;
    }

    if (typeof run.confirmResolver !== "function") {
      sendJson(response, 409, { error: "Esta execucao nao esta aguardando confirmacao." });
      return;
    }

    const resolver = run.confirmResolver;
    run.confirmResolver = null;
    run.awaitingConfirmation = null;
    run.status = "running";
    run.message = "Confirmacao recebida. Continuando execucao.";
    resolver("confirmed");

    sendJson(response, 200, {
      ok: true,
      runId,
      message: "Confirmacao registrada."
    });
    return;
  }

  // ── System Status ───────────────────────────────────
  if (request.method === "GET" && url.pathname === "/api/system-status") {
    const userId = url.searchParams.get("userId") || "default";
    const { checkLoginStatus } = require("../actions/sei/auth");
    
    // Para o SEI, fazemos uma checagem real se o robô consegue ver o sistema logado
    // Nota: Em produção, isso pode ser otimizado para não abrir o browser toda hora,
    // mas aqui ajuda a confirmar a sessão real.
    const seiStatus = { authenticated: false, user: null };
    try {
      // Checagem simplificada: apenas verifica se o robô detecta login
      // Para não pesar o servidor, o app.js chama isso a cada 5-10 segundos.
      const loginCheck = await checkLoginStatus(); 
      seiStatus.authenticated = loginCheck.loggedIn;
      seiStatus.user = loginCheck.user;
    } catch (e) {
      seiStatus.authenticated = false;
    }

    // Para o Outlook, simplificaremos verificando se o arquivo de estado existe
    const storagePath = path.join(projectRoot, "storage", "users", userId, "browser-state.json");
    const outlookStatus = { authenticated: fs.existsSync(storagePath) };

    sendJson(response, 200, {
      sei: seiStatus,
      outlook: outlookStatus,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // ── Email Settings ───────────────────────────────────
  if (request.method === "GET" && url.pathname === "/api/email-settings") {
    const userId = url.searchParams.get("userId") || "default";
    const settings = loadSettings(userId);
    const emailConfig = settings.email || {};

    sendJson(response, 200, {
      configured: Boolean(emailConfig.smtp?.user && emailConfig.smtp?.pass && emailConfig.smtp.pass !== "SUA-SENHA-DE-APP-AQUI"),
      user: emailConfig.smtp?.user || "",
      host: emailConfig.smtp?.host || "smtp.office365.com",
      port: emailConfig.smtp?.port || 587,
      defaultFrom: emailConfig.defaultFrom || "",
      sharedMailboxes: emailConfig.sharedMailboxes || []
    });
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/email-settings") {
    const body = await readRequestBody(request);
    const userId = body.userId || "default";
    const userProfilePath = path.join(projectRoot, "config", "users", `${userId}.json`);

    if (!fs.existsSync(userProfilePath)) {
      sendJson(response, 404, { error: "Perfil de usuario nao encontrado." });
      return;
    }

    const profile = JSON.parse(fs.readFileSync(userProfilePath, "utf8"));
    
    profile.email = {
      smtp: {
        host: body.host || "smtp.office365.com",
        port: Number(body.port) || 587,
        secure: false,
        user: body.user || "",
        pass: body.pass || ""
      },
      defaultFrom: body.defaultFrom || body.user || "",
      sharedMailboxes: body.sharedMailboxes || profile.email?.sharedMailboxes || []
    };

    fs.writeFileSync(userProfilePath, JSON.stringify(profile, null, 2), "utf8");

    sendJson(response, 200, {
      ok: true,
      message: "Configuracao de e-mail salva com sucesso."
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/email-test") {
    const body = await readRequestBody(request);
    const { testConnection } = require("../actions/email");

    const result = await testConnection({
      host: body.host || "smtp.office365.com",
      port: Number(body.port) || 587,
      secure: false,
      user: body.user || "",
      pass: body.pass || ""
    });

    sendJson(response, 200, result);
    return;
  }

  sendJson(response, 404, { error: "Endpoint nao encontrado." });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    serveStaticFile(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Erro interno no servidor."
    });
  }
});

server.listen(port, host, () => {
  console.log(`SEI Flow Platform web em http://${host}:${port}`);
});
