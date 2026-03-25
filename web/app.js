const state = {
  users: [],
  selectedUserId: "default",
  flows: [],
  library: {
    installed: [],
    inDevelopment: []
  },
  runs: [],
  activeRunId: null,
  activeRun: null,
  pollTimer: null,
  submitting: false,
  autoFocusRunId: null
};

const userSelect = document.querySelector("#user-id");
const flowType = document.querySelector("#flow-type");
const dynamicFields = document.querySelector("#dynamic-fields");
const previewType = document.querySelector("#preview-type");
const previewBody = document.querySelector("#preview-body");
const executionList = document.querySelector("#execution-list");
const flowForm = document.querySelector("#flow-form");
const libraryAvailable = document.querySelector("#library-available");
const libraryDeveloping = document.querySelector("#library-developing");
const connectionBadge = document.querySelector("#connection-badge");
const selectedUserBadge = document.querySelector("#selected-user-badge");
const comfortTitle = document.querySelector("#comfort-title");
const comfortText = document.querySelector("#comfort-text");
const runNotice = document.querySelector("#run-notice");
const countRunning = document.querySelector("#count-running");
const countFinished = document.querySelector("#count-finished");
const countAttention = document.querySelector("#count-attention");
const stageBanner = document.querySelector("#stage-banner");
const stageBannerTitle = document.querySelector("#stage-banner-title");
const stageBannerText = document.querySelector("#stage-banner-text");
const stageBannerButton = document.querySelector("#stage-banner-button");
const loadingPanel = document.querySelector("#loading-panel");
const loadingTitle = document.querySelector("#loading-title");
const loadingText = document.querySelector("#loading-text");
const activeRunTitle = document.querySelector("#active-run-title");
const activeRunMeta = document.querySelector("#active-run-meta");
const activeRunStatus = document.querySelector("#active-run-status");
const activeRunMessage = document.querySelector("#active-run-message");
const activeRunHelper = document.querySelector("#active-run-helper");
const activeRunGuidance = document.querySelector("#active-run-guidance");
const confirmationCard = document.querySelector("#confirmation-card");
const confirmationTitle = document.querySelector("#confirmation-title");
const confirmationMessage = document.querySelector("#confirmation-message");
const confirmationButton = document.querySelector("#confirmation-button");
const progressTimeline = document.querySelector("#progress-timeline");
const feedbackBanner = document.querySelector("#feedback-banner");
const submitButton = document.querySelector("#submit-button");
const stepOpen = document.querySelector("#step-open");
const stepLogin = document.querySelector("#step-login");
const stepSearch = document.querySelector("#step-search");
const stepFinish = document.querySelector("#step-finish");

function api(path, options = {}) {
  return fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Falha na comunicacao com o servidor local.");
    }
    return payload;
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatTimestamp(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date(value));
}

function getSelectedFlow() {
  return state.flows.find((flow) => flow.id === flowType.value) || state.flows[0] || null;
}

function getSelectedUser() {
  return state.users.find((user) => user.id === state.selectedUserId) || null;
}

function setConnectionBadge(label, status = "") {
  connectionBadge.textContent = label;
  connectionBadge.dataset.status = status;
}

function setComfortState(title, text) {
  comfortTitle.textContent = title;
  comfortText.textContent = text;
}

function showBanner(message, type = "success") {
  feedbackBanner.textContent = message;
  feedbackBanner.className = `inline-message inline-message--${type}`;
}

function hideBanner() {
  feedbackBanner.className = "inline-message hidden";
  feedbackBanner.textContent = "";
}

function clearFieldErrors() {
  dynamicFields.querySelectorAll(".field-error").forEach((node) => node.remove());
}

function defaultValueForInput(input) {
  if (input.id === "manualLogin") {
    return "true";
  }

  if (input.id === "tipoDocumento") {
    return "Despacho";
  }
  return "";
}

function createField(input) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";

  const label = document.createElement("label");
  label.htmlFor = `input-${input.id}`;
  label.innerHTML = input.required
    ? `${escapeHtml(input.label)}<span class="required-mark">*</span>`
    : escapeHtml(input.label);
  wrapper.appendChild(label);

  let field;

  if (input.type === "textarea") {
    field = document.createElement("textarea");
    field.rows = 4;
  } else if (input.type === "boolean") {
    field = document.createElement("select");
    field.innerHTML = `
      <option value="true">Sim</option>
      <option value="false">Nao</option>
    `;
  } else {
    field = document.createElement("input");
    field.type = "text";
  }

  field.id = `input-${input.id}`;
  field.name = input.id;
  field.dataset.required = input.required ? "true" : "false";
  field.required = Boolean(input.required);
  field.placeholder = input.id === "processo" ? "0000000-00.0000.0.00.0000" : input.label;
  field.value = defaultValueForInput(input);
  wrapper.appendChild(field);

  return wrapper;
}

function renderUsers() {
  userSelect.innerHTML = state.users
    .map(
      (user) =>
        `<option value="${user.id}">${escapeHtml(user.displayName)} (${escapeHtml(
          user.id
        )})</option>`
    )
    .join("");
  userSelect.value = state.selectedUserId;

  const selectedUser = getSelectedUser();
  selectedUserBadge.textContent = selectedUser
    ? `${selectedUser.displayName} | ${selectedUser.unit}`
    : "Usuario";
}

function renderFlows() {
  flowType.innerHTML = state.flows
    .map((flow) => `<option value="${flow.id}">${escapeHtml(flow.name)}</option>`)
    .join("");
}

function renderFields() {
  const flow = getSelectedFlow();
  dynamicFields.innerHTML = "";

  if (!flow) {
    return;
  }

  flow.inputs.forEach((input) => {
    dynamicFields.appendChild(createField(input));
  });
}

function getFormInput() {
  const flow = getSelectedFlow();
  const values = {};
  const formData = new FormData(flowForm);

  if (!flow) {
    return values;
  }

  flow.inputs.forEach((input) => {
    const value = String(formData.get(input.id) || "").trim();
    if (value === "") {
      return;
    }

    values[input.id] = value;
  });

  return values;
}

function validateForm() {
  clearFieldErrors();

  const flow = getSelectedFlow();
  const formData = new FormData(flowForm);
  if (!flow) {
    return false;
  }

  let valid = true;
  flow.inputs.forEach((input) => {
    const field = flowForm.querySelector(`[name="${input.id}"]`);
    if (!field || field.dataset.required !== "true") {
      return;
    }

    const value = String(formData.get(input.id) || "").trim();
    if (value) {
      return;
    }

    valid = false;
    const error = document.createElement("div");
    error.className = "field-error";
    error.textContent = `${input.label} e obrigatorio.`;
    field.insertAdjacentElement("afterend", error);
  });

  return valid;
}

function summarizeInput(flow, formData) {
  if (!flow) {
    return "Selecione um fluxo para iniciar.";
  }

  const pieces = flow.inputs.map((input) => {
    const value = formData[input.id];
    if (!value) {
      return `${input.label}: nao informado`;
    }

    if (input.type === "boolean") {
      return `${input.label}: ${value === "true" ? "sim" : "nao"}`;
    }

    return `${input.label}: ${value}`;
  });

  return `${flow.name} para ${state.selectedUserId}. ${pieces.join(" | ")}`;
}

function renderPreview() {
  const flow = getSelectedFlow();
  const input = getFormInput();

  previewType.textContent = flow ? flow.name : "Fluxo";
  previewBody.textContent = summarizeInput(flow, input);

  if (!flow) {
    runNotice.textContent = "Selecione um fluxo para continuar.";
    return;
  }

  if (flow.id === "consultar-processo") {
    runNotice.textContent =
      "Este fluxo pode abrir o navegador do SEI e parar na etapa de login. Se houver 2FA, conclua no navegador e depois clique em 'Continuar execucao' aqui na tela.";
    return;
  }

  runNotice.textContent =
    "A execucao sera feita pelo runner local desta maquina. Logs e resultados ficam salvos no storage do usuario.";
}

function mapRunStatus(run) {
  if (run.status === "awaiting-user") {
    return "aguardando validacao";
  }

  if (["queued", "running"].includes(run.status)) {
    return "executando";
  }

  if (
    [
      "search-results-found",
      "search-submitted",
      "dry-run",
      "pending-implementation",
      "document-generated"
    ].includes(
      run.status
    )
  ) {
    return "concluido";
  }

  if (String(run.status || "").includes("error") || run.status === "search-not-found") {
    return "erro";
  }

  return run.status || "inativo";
}

function getMostRelevantRun(runs) {
  return (
    runs.find((run) => ["awaiting-user", "running", "queued"].includes(run.status)) ||
    runs[0] ||
    null
  );
}

function toFriendlyStatus(run) {
  const statusLabel = mapRunStatus(run);

  if (run.status === "awaiting-user") {
    return "Esperando voce";
  }

  if (statusLabel === "executando") {
    return "Em andamento";
  }

  if (statusLabel === "concluido") {
    return "Concluido";
  }

  if (statusLabel === "erro") {
    return "Precisa de atencao";
  }

  return "Aguardando";
}

function getFriendlyRunTitle(run) {
  if (!run) {
    return "Nenhuma execucao selecionada";
  }

  return run.flow?.name || "Execucao";
}

function getFriendlyMessage(run) {
  if (!run) {
    return "Quando voce iniciar um fluxo, eu vou mostrar aqui o andamento com orientacoes claras.";
  }

  if (run.status === "awaiting-user") {
    return "Seu fluxo parou no ponto certo para voce concluir uma etapa importante. Assim que terminar, clique para continuar.";
  }

  if (run.status === "search-results-found") {
    return "Tudo certo. O processo foi encontrado e aberto com sucesso.";
  }

  if (run.status === "search-submitted") {
    return "A busca foi enviada e o sistema terminou a etapa principal.";
  }

  if (run.status === "document-generated") {
    return "Tudo certo. O despacho foi criado e salvo na pasta do usuario.";
  }

  if (run.status === "search-not-found") {
    return "Nao consegui confirmar a busca automaticamente. Vale revisar esta execucao com calma.";
  }

  if (run.status === "pending-implementation") {
    return "Este fluxo ainda nao executa a automacao completa, mas a estrutura dele ja esta preparada.";
  }

  if (["queued", "running"].includes(run.status)) {
    return "Estou conduzindo a execucao agora. Se algo depender de voce, vou avisar nesta tela.";
  }

  if (run.status === "error") {
    return "Algo impediu a continuidade da execucao. Veja os detalhes e tente novamente.";
  }

  return run.message || "Execucao em acompanhamento.";
}

function setStepState(node, state) {
  node.dataset.state = state;
}

function renderSteps(run) {
  [stepOpen, stepLogin, stepSearch, stepFinish].forEach((node) => {
    setStepState(node, "idle");
  });

  if (!run) {
    return;
  }

  const progress = run.progressEvents || [];
  const phases = progress.map((event) => event.phase);

  if (phases.includes("opening-browser") || progress.length) {
    setStepState(stepOpen, "done");
  }

  if (run.status === "awaiting-user" || phases.includes("manual-login")) {
    setStepState(stepLogin, run.status === "awaiting-user" ? "current" : "done");
  }

  if (phases.includes("manual-login-confirmed") || phases.includes("searching")) {
    setStepState(stepLogin, "done");
    setStepState(stepSearch, run.status === "running" ? "current" : "done");
  }

  if (["search-results-found", "search-submitted", "search-not-found"].includes(run.status)) {
    setStepState(stepOpen, "done");
    setStepState(stepLogin, "done");
    setStepState(stepSearch, "done");
    setStepState(stepFinish, run.status === "search-not-found" ? "error" : "done");
  }

  if (run.status === "error") {
    setStepState(stepFinish, "error");
  }
}

function renderStageBanner(run) {
  if (!run) {
    stageBanner.classList.add("hidden");
    stageBannerButton.classList.add("hidden");
    return;
  }

  const statusLabel = mapRunStatus(run);
  const canContinue = run.status === "awaiting-user" && Boolean(run.awaitingConfirmation);

  if (canContinue) {
    stageBanner.classList.remove("hidden");
    stageBanner.dataset.state = "waiting";
    stageBannerTitle.textContent = "Agora falta voce";
    stageBannerText.textContent =
      "Se voce ja terminou o login no navegador, clique no botao para eu continuar daqui.";
    stageBannerButton.textContent = run.awaitingConfirmation.label || "Continuar execucao";
    stageBannerButton.classList.remove("hidden");
    return;
  }

  if (["executando"].includes(statusLabel)) {
    stageBanner.classList.remove("hidden");
    stageBanner.dataset.state = "running";
    stageBannerTitle.textContent = "Estou cuidando da execucao";
    stageBannerText.textContent =
      "Voce nao precisa fazer nada agora. Assim que eu precisar de alguma acao sua, vou destacar aqui.";
    stageBannerButton.classList.add("hidden");
    return;
  }

  if (["concluido", "erro"].includes(statusLabel)) {
    stageBanner.classList.remove("hidden");
    stageBanner.dataset.state = statusLabel === "concluido" ? "success" : "error";
    stageBannerTitle.textContent =
      statusLabel === "concluido" ? "Execucao finalizada" : "Algo precisa de revisao";
    stageBannerText.textContent =
      statusLabel === "concluido"
        ? "A etapa principal terminou. Voce pode revisar os detalhes abaixo ou iniciar outra execucao."
        : "A execucao terminou com um ponto de atencao. Veja os detalhes abaixo.";
    stageBannerButton.classList.add("hidden");
    return;
  }

  stageBanner.classList.add("hidden");
  stageBannerButton.classList.add("hidden");
}

function renderRuns() {
  executionList.innerHTML = state.runs
    .map((run) => {
      const statusLabel = mapRunStatus(run);
      const isActive = state.activeRunId === run.runId;

      return `
        <article class="run-card ${isActive ? "run-card--active" : ""}" data-run-id="${escapeHtml(
          run.runId
        )}">
          <div class="run-card__top">
            <div class="run-card__identity">
              <div class="run-card__title">${escapeHtml(
                run.flow?.name || run.flow?.id || "Execucao"
              )}</div>
              <div class="run-card__meta run-card__meta--mono">${escapeHtml(run.runId)}</div>
            </div>
            <span class="status-chip" data-status="${escapeHtml(statusLabel)}">${escapeHtml(
              toFriendlyStatus(run)
            )}</span>
          </div>
          <div class="run-card__body">${escapeHtml(getFriendlyMessage(run))}</div>
          <div class="run-card__meta">${escapeHtml(formatTimestamp(run.startedAt))}</div>
        </article>
      `;
    })
    .join("");

  executionList.querySelectorAll("[data-run-id]").forEach((node) => {
    node.addEventListener("click", async () => {
      state.activeRunId = node.dataset.runId;
      state.autoFocusRunId = null;
      await loadRunDetails();
      renderRuns();
    });
  });

  countRunning.textContent = String(
    state.runs.filter((run) => ["running", "awaiting-user", "queued"].includes(run.status)).length
  );
  countFinished.textContent = String(
    state.runs.filter((run) =>
      [
        "search-results-found",
        "search-submitted",
        "dry-run",
        "pending-implementation",
        "document-generated"
      ].includes(run.status)
    ).length
  );
  countAttention.textContent = String(
    state.runs.filter((run) => ["awaiting-user", "search-not-found", "error"].includes(run.status))
      .length
  );
}

function renderLibrary() {
  libraryAvailable.innerHTML = state.flows
    .map((flow) => {
      const item = flow.library || {};
      return `
        <article class="library-card library-card--available">
          <div class="library-card__top">
            <strong>${escapeHtml(flow.name)}</strong>
            <span class="status-chip" data-status="concluido">Disponivel</span>
          </div>
          <div class="run-card__meta">${escapeHtml(item.category || "Fluxo")}</div>
          <p>${escapeHtml(item.summary || flow.description || "")}</p>
        </article>
      `;
    })
    .join("");

  libraryDeveloping.innerHTML = (state.library.inDevelopment || [])
    .map(
      (item) => `
        <article class="library-card">
          <div class="library-card__top">
            <strong>${escapeHtml(item.headline || item.id)}</strong>
            <span class="status-chip" data-status="aguardando validacao">Em desenvolvimento</span>
          </div>
          <div class="run-card__meta">${escapeHtml(item.category || "Fluxo")}</div>
          <p>${escapeHtml(item.summary || "")}</p>
        </article>
      `
    )
    .join("");
}

function renderTimeline(events = []) {
  progressTimeline.innerHTML = events.length
    ? events
        .map(
          (event) => `
            <article class="timeline-item">
              <strong>${escapeHtml(event.phase || event.status || "evento")}</strong>
              <span>${escapeHtml(event.message || "")}</span>
              <small>${escapeHtml(formatTimestamp(event.timestamp))}</small>
            </article>
          `
        )
        .join("")
    : '<div class="run-card__meta">Sem eventos detalhados disponiveis para esta execucao.</div>';
}

function renderActiveRun() {
  const run = state.activeRun;

  if (!run) {
    activeRunTitle.textContent = "Nenhuma execucao selecionada";
    activeRunMeta.textContent = "";
    activeRunStatus.textContent = "Aguardando";
    activeRunStatus.dataset.status = "inativo";
    activeRunMessage.textContent =
      "Inicie um fluxo ou selecione uma execucao recente para acompanhar cada etapa com calma.";
    activeRunHelper.textContent =
      "Assim que uma execucao comecar, eu vou te explicar o que esta acontecendo sem linguagem tecnica.";
    activeRunGuidance.textContent =
      "Quando alguma acao sua for necessaria, a interface vai destacar isso de forma clara.";
    setComfortState(
      "Tudo pronto para começar",
      "Escolha o fluxo, preencha os campos e clique em executar. Eu vou te mostrar cada etapa para que voce saiba exatamente o que esta acontecendo."
    );
    loadingPanel.classList.add("hidden");
    confirmationCard.classList.add("hidden");
    renderSteps(null);
    renderStageBanner(null);
    renderTimeline([]);
    return;
  }

  const statusLabel = mapRunStatus(run);
  activeRunTitle.textContent = getFriendlyRunTitle(run);
  activeRunMeta.textContent = `${run.runId} | ${formatTimestamp(run.startedAt)}`;
  activeRunStatus.textContent = toFriendlyStatus(run);
  activeRunStatus.dataset.status = statusLabel;
  activeRunMessage.textContent = getFriendlyMessage(run);
  activeRunHelper.textContent = run.awaitingConfirmation
    ? "Eu parei no momento certo para voce concluir uma etapa importante e depois seguir."
    : statusLabel === "concluido"
      ? "Esta rodada terminou. Se quiser, voce pode revisar e iniciar outra em seguida."
      : "Estou acompanhando esta rodada em tempo real e atualizando o painel automaticamente.";
  activeRunGuidance.textContent =
    run.flow?.id === "consultar-processo"
      ? "Se o navegador do SEI abrir, entre normalmente. Quando terminar, volte para esta tela se aparecer um pedido de continuidade."
      : "Antes de iniciar novas rodadas, confira os dados informados para evitar retrabalho.";
  setComfortState(
    run.awaitingConfirmation ? "Sua ajuda e necessaria agora" : "Tudo sob controle",
    run.awaitingConfirmation
      ? "Finalize a etapa no navegador e depois clique para continuar. Eu vou esperar voce."
      : statusLabel === "concluido"
        ? "Esta execucao terminou. Voce pode revisar o resultado ou iniciar uma nova."
        : "A execucao esta em andamento. Se eu precisar de algo, vou destacar aqui."
  );
  if (["running", "queued", "awaiting-user"].includes(run.status)) {
    loadingPanel.classList.remove("hidden");
    loadingTitle.textContent = run.awaitingConfirmation
      ? "Aguardando sua confirmacao"
      : "Processando sua execucao";
    loadingText.textContent = run.awaitingConfirmation
      ? "Volte para esta tela quando terminar no navegador. Assim que voce confirmar, eu continuo."
      : "Estou executando os passos e atualizando este painel automaticamente para voce acompanhar.";
  } else {
    loadingPanel.classList.add("hidden");
  }
  renderSteps(run);
  renderStageBanner(run);
  renderTimeline(run.progressEvents || []);

  if (run.status === "awaiting-user" && run.awaitingConfirmation) {
    confirmationTitle.textContent = "Quando terminar no navegador, volte aqui";
    confirmationMessage.textContent =
      "Se voce ja concluiu o login ou a validacao no navegador, clique no botao abaixo para seguir.";
    confirmationButton.textContent = "Continuar execucao";
    confirmationCard.classList.remove("hidden");
  } else {
    confirmationCard.classList.add("hidden");
  }
}

function updateSubmitState() {
  submitButton.disabled = state.submitting;
  submitButton.textContent = state.submitting ? "Iniciando..." : "Executar agora";
}

async function loadUsers() {
  const payload = await api("/api/users");
  state.users = payload.users;
  state.selectedUserId = payload.defaultUserId || payload.users[0]?.id || "default";
  renderUsers();
}

async function loadFlows() {
  const payload = await api(`/api/flows?userId=${encodeURIComponent(state.selectedUserId)}`);
  state.flows = payload.flows;
  state.library = payload.library || {
    installed: [],
    inDevelopment: []
  };
  renderFlows();
  renderFields();
  renderPreview();
  renderLibrary();
}

async function loadRuns() {
  const payload = await api(`/api/runs?userId=${encodeURIComponent(state.selectedUserId)}`);
  state.runs = payload.runs;

  if (!state.runs.length) {
    state.activeRunId = null;
    return;
  }

  if (state.autoFocusRunId) {
    const targetRun = state.runs.find((run) => run.runId === state.autoFocusRunId);
    if (targetRun) {
      state.activeRunId = targetRun.runId;
      if (!["awaiting-user", "running", "queued"].includes(targetRun.status)) {
        state.autoFocusRunId = null;
      }
      return;
    }
  }

  const activeStillExists = state.runs.some((run) => run.runId === state.activeRunId);
  if (!state.activeRunId || !activeStillExists) {
    const preferredRun = getMostRelevantRun(state.runs);
    state.activeRunId = preferredRun?.runId || null;
  }
}

async function loadRunDetails() {
  if (!state.activeRunId) {
    state.activeRun = null;
    renderActiveRun();
    return;
  }

  state.activeRun = await api(
    `/api/runs/${encodeURIComponent(state.activeRunId)}?userId=${encodeURIComponent(
      state.selectedUserId
    )}`
  );
  renderActiveRun();
}

async function refreshAll() {
  await loadRuns();
  await loadRunDetails();
  renderRuns();
}

async function handleSubmit(event) {
  event.preventDefault();
  hideBanner();

  if (!validateForm()) {
    showBanner("Preencha os campos obrigatorios antes de executar.", "error");
    return;
  }

  const flow = getSelectedFlow();
  if (!flow) {
    showBanner("Nenhum fluxo selecionado.", "error");
    return;
  }

  state.submitting = true;
  updateSubmitState();
  setConnectionBadge("Executando", "executando");

  try {
    const payload = await api("/api/runs", {
      method: "POST",
      body: JSON.stringify({
        userId: state.selectedUserId,
        flowId: flow.id,
        input: getFormInput()
      })
    });

    state.activeRunId = payload.runId;
    state.autoFocusRunId = payload.runId;
    await refreshAll();
    showBanner("Execucao iniciada. Acompanhe o progresso no painel ao lado.", "success");
    setComfortState(
      "Execucao iniciada",
      "Eu ja comecei a rodada e vou te orientar pelo painel da direita. Se algo depender de voce, vou avisar com destaque."
    );
    setConnectionBadge("Conectado", "concluido");
  } catch (error) {
    showBanner(error.message, "error");
    setConnectionBadge("Falha", "erro");
  } finally {
    state.submitting = false;
    updateSubmitState();
  }
}

async function handleContinue() {
  if (!state.activeRunId) {
    return;
  }

  confirmationButton.disabled = true;

  try {
    await api(`/api/runs/${encodeURIComponent(state.activeRunId)}/continue`, {
      method: "POST",
      body: JSON.stringify({})
    });
    showBanner("Perfeito. Vou continuar a execucao agora.", "success");
    await refreshAll();
  } catch (error) {
    showBanner(error.message, "error");
  } finally {
    confirmationButton.disabled = false;
  }
}

async function initialize() {
  try {
    setConnectionBadge("Conectando", "executando");
    await loadUsers();
    await loadFlows();
    await refreshAll();
    setConnectionBadge("Conectado", "concluido");
  } catch (error) {
    setConnectionBadge("Falha", "erro");
    showBanner(error.message, "error");
  }
}

userSelect.addEventListener("change", async () => {
  hideBanner();
  state.selectedUserId = userSelect.value;
  state.activeRunId = null;
  state.activeRun = null;
  await loadFlows();
  await refreshAll();
  renderUsers();
});

flowType.addEventListener("change", () => {
  hideBanner();
  renderFields();
  renderPreview();
  clearFieldErrors();
});

flowForm.addEventListener("input", () => {
  renderPreview();
});

flowForm.addEventListener("submit", (event) => {
  handleSubmit(event).catch((error) => {
    showBanner(error.message, "error");
  });
});

confirmationButton.addEventListener("click", () => {
  handleContinue().catch((error) => {
    showBanner(error.message, "error");
  });
});

stageBannerButton.addEventListener("click", () => {
  handleContinue().catch((error) => {
    showBanner(error.message, "error");
  });
});

initialize();
state.pollTimer = window.setInterval(() => {
  refreshAll().catch(() => null);
}, 2500);
