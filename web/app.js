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
  autoFocusRunId: null,
  filterSystem: "TODOS",
  filterContext: "TODOS"
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

// Helper para atualizar o DOM com seguranca (evita erros se o ID nao existir)
function safeUpdate(selector, property, value) {
  const el = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (el) {
    el[property] = value;
    return true;
  }
  return false;
}

function safeSetText(selector, text) { return safeUpdate(selector, "textContent", text); }
function safeSetHTML(selector, html) { return safeUpdate(selector, "innerHTML", html); }

function getSelectedFlow() {
  return state.flows.find((flow) => flow.id === flowType?.value) || state.flows[0] || null;
}

function getSelectedUser() {
  return state.users.find((user) => user.id === state.selectedUserId) || null;
}

function setConnectionBadge(label, status = "") {
  safeSetText("#connection-badge", label);
  const el = document.querySelector("#connection-badge");
  if (el) el.dataset.status = status;
}

function setComfortState(title, text) {
  safeSetText("#comfort-title", title);
  safeSetText("#comfort-text", text);
}

function showBanner(message, type = "success") {
  safeSetText("#feedback-banner", message);
  const el = document.querySelector("#feedback-banner");
  if (el) el.className = `inline-message inline-message--${type}`;
}

function hideBanner() {
  const el = document.querySelector("#feedback-banner");
  if (el) {
    el.className = "inline-message hidden";
    el.textContent = "";
  }
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
  } else if (input.type === "select") {
    field = document.createElement("select");
    if (input.options && Array.isArray(input.options)) {
      input.options.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt.value || opt;
        option.textContent = opt.label || opt;
        field.appendChild(option);
      });
    }
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
  if (userSelect) {
    userSelect.innerHTML = state.users
      .map(
        (user) =>
          `<option value="${user.id}">${escapeHtml(user.displayName)} (${escapeHtml(
            user.id
          )})</option>`
      )
      .join("");
    userSelect.value = state.selectedUserId;
  }

  const selectedUser = getSelectedUser();
  safeSetText("#selected-user-badge", selectedUser
    ? `${selectedUser.displayName} | ${selectedUser.unit}`
    : "Usuario");
}

function renderFlows() {
  const container = document.getElementById("flows-grid-container");
  if (!container) return;
  
  try {
    // Filtrar fluxos por Sistema e Contexto
    const filteredFlows = state.flows.filter(flow => {
      // Filtro de Sistema
      if (state.filterSystem !== "TODOS") {
        let sysBadge = "SEI";
        const nameUpper = (flow.name || "").toUpperCase();
        if (nameUpper.includes("PJE")) sysBadge = "PJE";
        else if (nameUpper.includes("SAP")) sysBadge = "SAP WEB";
        else if (nameUpper.includes("E-MAIL")) sysBadge = "OUTLOOK";
        
        if (sysBadge !== state.filterSystem) return false;
      }

      // Filtro de Contexto (Categoria)
      if (state.filterContext !== "TODOS") {
        const cat = (flow.category || "PROCESSUAL").toUpperCase();
        if (cat !== state.filterContext) return false;
      }

      return true;
    });

    // Agrupar fluxos por categoria
    const groups = {};
    filteredFlows.forEach(flow => {
      const cat = (flow.category || "PROCESSUAL").toUpperCase();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(flow);
    });

    let html = "";
    
    // Ordenar categorias (opcional)
    const sortedCategories = Object.keys(groups).sort();

    if (filteredFlows.length === 0) {
      container.innerHTML = `<div class="log-empty" style="grid-column: 1/-1; padding: 60px;">Nenhum fluxo encontrado para os filtros selecionados.</div>`;
      return;
    }

    sortedCategories.forEach(cat => {
      // Adicionar header da categoria
      html += `<div class="category-header">${cat}</div>`;

      groups[cat].forEach(flow => {
        let sysBadge = "SEI";
        const nameUpper = (flow.name || "").toUpperCase();
        if (nameUpper.includes("PJE")) sysBadge = "PJE";
        else if (nameUpper.includes("SAP")) sysBadge = "SAP WEB";
        else if (nameUpper.includes("E-MAIL")) sysBadge = "OUTLOOK";
        html += `
          <div class="flow-card" onclick="openFlowPanel('${escapeHtml(flow.id)}')">
            <div class="flow-card__badge" data-sys="${sysBadge}">${sysBadge}</div>
            <div class="flow-card__top">
              <div class="flow-card__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <div class="flow-card__info">
                <div class="flow-card__title">${escapeHtml(flow.name)}</div>
                <div class="flow-card__category">${cat}</div>
              </div>
            </div>
            <p>${escapeHtml(flow.description || "Inicie este fluxo para realizar o processamento inteligente no ambiente alvo.")}</p>
            <div class="flow-card__actions">
              <div class="flow-card__tags">INDIVIDUAL &nbsp; <span style="color:#f59e0b">✦ STITCHED</span></div>
              <div class="flow-card__exec">EXECUTAR ↗</div>
            </div>
          </div>
        `;
      });
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="grid-column: 1/-1; color: red;">Error renderFlows: ${err.message}<pre>${err.stack}</pre></div>`;
    console.error(err);
  }
}

function openFlowPanel(flowId) {
  document.getElementById("flow-type").value = flowId;
  const panel = document.getElementById("execution-panel");
  const flow = state.flows.find((f) => f.id === flowId);

  // Reset panel state
  hideBanner();
  clearFieldErrors();
  renderFields();
  renderPreview();

  // Update panel header
  const titleEl = document.getElementById("panel-flow-title");
  const badgeEl = document.getElementById("panel-flow-badge");
  if (titleEl && flow) titleEl.textContent = flow.name;
  if (badgeEl && flow) {
    const nameUpper = (flow.name || "").toUpperCase();
    if (nameUpper.includes("PJE")) {
      badgeEl.textContent = "PJE";
      badgeEl.style.background = "#dc2626";
    } else if (nameUpper.includes("E-MAIL")) {
      badgeEl.textContent = "OUTLOOK";
      badgeEl.style.background = "#0078d4"; // Office 365 Blue
    } else {
      badgeEl.textContent = "SEI";
      badgeEl.style.background = "#2563eb";
    }
  }

  // Reset to config tab
  switchTab("config");

  panel.classList.remove("hidden");
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.toggle("active", content.id === "tab-" + tabName);
  });

  // If switching to history, render runs
  if (tabName === "history") {
    renderRuns();
  }
}

function filterFlowCards(query) {
  const cards = document.querySelectorAll(".flow-card");
  const q = (query || "").toLowerCase().trim();
  cards.forEach((card) => {
    const title = (card.querySelector(".flow-card__title")?.textContent || "").toLowerCase();
    const desc = (card.querySelector("p")?.textContent || "").toLowerCase();
    card.style.display = (!q || title.includes(q) || desc.includes(q)) ? "" : "none";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("btn-close-panel");
  const backdrop = document.getElementById("panel-close-backdrop");
  const panel = document.getElementById("execution-panel");
  const hidePanel = () => panel.classList.add("hidden");
  if (closeBtn) closeBtn.onclick = hidePanel;
  if (backdrop) backdrop.onclick = hidePanel;

  // Search bar
  const searchInput = document.querySelector(".search-bar input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => filterFlowCards(e.target.value));
  }

  // System Tabs Navigation
  document.querySelectorAll(".sys-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".sys-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.filterSystem = tab.dataset.sys;
      renderFlows();
    });
  });

  // Context Sidebar Filters
  document.querySelectorAll(".catalogo-filters .filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parent = btn.parentElement;
      parent.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      
      const filterGroup = parent.id;
      if (filterGroup === "filter-system-group") {
        state.filterSystem = btn.dataset.filter;
      } else {
        state.filterContext = btn.dataset.filter;
      }
      renderFlows();
    });
  });
});

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
      "document-generated",
      "document-created-in-sei",
      "email-sent"
    ].includes(
      run.status
    )
  ) {
    return "concluido";
  }

  if (String(run.status || "").includes("error") || run.status === "search-not-found" || run.status === "document-fill-failed" || run.status === "process-restricted" || run.status === "include-document-not-found" || run.status === "process-open-failed" || run.status === "email-failed") {
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

  if (run.status === "email-sent") {
    return "E-mail enviado com sucesso. Verifique se a cópia chegou, se aplicável.";
  }

  if (run.status === "email-failed") {
    return "Falha ao enviar e-mail. Verifique suas credenciais de configuração e a conexão com o servidor.";
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
      switchTab("execution");
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

    // Auto-switch to execution tab
    switchTab("execution");
    const badge = document.getElementById("tab-execution-badge");
    if (badge) badge.classList.remove("hidden");

    showBanner("Execucao iniciada. Acompanhe o progresso na aba Execucao.", "success");
    setComfortState(
      "Execucao iniciada",
      "Eu ja comecei a rodada e vou te orientar por aqui. Se algo depender de voce, vou avisar com destaque."
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

function setupFilters() {
  const sysGroup = document.getElementById("filter-system-group");
  const ctxGroup = document.getElementById("filter-context-group");

  if (sysGroup) {
    const buttons = sysGroup.querySelectorAll(".filter-btn");
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.filterSystem = btn.dataset.filter;
        renderFlows();
      });
    });
  }

  if (ctxGroup) {
    const buttons = ctxGroup.querySelectorAll(".filter-btn");
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.filterContext = btn.dataset.filter;
        renderFlows();
      });
    });
  }
}

async function initialize() {
  try {
    setConnectionBadge("Conectando", "executando");
    await loadUsers();
    await loadFlows();
    await refreshAll();
    setupFilters();
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

async function refreshStatus() {
  const seiEl = document.getElementById("status-sei");
  const outlookEl = document.getElementById("status-outlook");

  if (!seiEl || !outlookEl) return;

  try {
    const data = await api("/api/system-status");
    
    // Atualiza SEI
    if (data.sei?.authenticated) {
      seiEl.className = "status-indicator online";
      seiEl.textContent = "ON";
      seiEl.title = `Logado como ${data.sei.user}`;
    } else {
      seiEl.className = "status-indicator offline";
      seiEl.textContent = "OFF";
      seiEl.title = "Sessão expirada ou não autenticada";
    }

    // Atualiza Outlook
    if (data.outlook?.authenticated) {
      outlookEl.className = "status-indicator online";
      outlookEl.textContent = "ON";
    } else {
      outlookEl.className = "status-indicator offline";
      outlookEl.textContent = "OFF";
    }
  } catch (e) {
    // Silently fail or show neutral
    seiEl.textContent = "OFFLINE";
    outlookEl.textContent = "OFFLINE";
  }
}

async function initialize() {
  try {
    const [usersData, flowsData] = await Promise.all([
      api("/api/users"),
      api("/api/flows")
    ]);

    state.users = usersData.users || [];
    state.flows = flowsData.flows || [];
    state.library = flowsData.library || { installed: [], inDevelopment: [] };

    renderUsers();
    renderFlows();
    renderLibrary();
    refreshStatus(); // Initial status check
  } catch (error) {
    showBanner("Falha ao inicializar dados do servidor.", "error");
  }
}

initialize();
state.pollTimer = window.setInterval(() => {
  refreshAll().catch(() => null);
  refreshStatus().catch(() => null);
}, 5000);

// ── Email Settings Modal ─────────────────────────────
async function openEmailSettings() {
  const modal = document.getElementById("email-settings-modal");
  const statusEl = document.getElementById("email-status");
  statusEl.className = "modal-status";
  statusEl.textContent = "";

  try {
    const data = await api(`/api/email-settings?userId=${state.selectedUserId}`);
    document.getElementById("smtp-user").value = data.user || "";
    document.getElementById("smtp-host").value = data.host || "smtp.office365.com";
    document.getElementById("smtp-port").value = data.port || 587;

    if (data.configured) {
      statusEl.className = "modal-status success";
      statusEl.textContent = "✅ E-mail já configurado: " + data.user;
    } else {
      statusEl.className = "modal-status info";
      statusEl.textContent = "📧 Configure seu e-mail para habilitar o envio automático.";
    }
  } catch (e) {
    statusEl.className = "modal-status info";
    statusEl.textContent = "📧 Primeira configuração. Preencha os dados abaixo.";
  }

  document.getElementById("smtp-pass").value = "";
  modal.classList.remove("hidden");
}

function closeEmailSettings() {
  document.getElementById("email-settings-modal").classList.add("hidden");
}

async function testEmailConnection() {
  const statusEl = document.getElementById("email-status");
  const btn = document.getElementById("btn-test-email");
  const user = document.getElementById("smtp-user").value.trim();
  const pass = document.getElementById("smtp-pass").value;
  const host = document.getElementById("smtp-host").value.trim();
  const port = document.getElementById("smtp-port").value;

  if (!user || !pass) {
    statusEl.className = "modal-status error";
    statusEl.textContent = "❌ Preencha o e-mail e a senha antes de testar.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "⏳ Testando...";
  statusEl.className = "modal-status info";
  statusEl.textContent = "🔄 Conectando ao servidor SMTP...";

  try {
    const result = await api("/api/email-test", {
      method: "POST",
      body: JSON.stringify({ user, pass, host, port: Number(port) })
    });

    if (result.ok) {
      statusEl.className = "modal-status success";
      statusEl.textContent = "✅ Conexão bem-sucedida! Seu e-mail está pronto para envio.";
    } else {
      statusEl.className = "modal-status error";
      statusEl.textContent = "❌ Falha na conexão: " + (result.error || "Erro desconhecido");
    }
  } catch (e) {
    statusEl.className = "modal-status error";
    statusEl.textContent = "❌ Erro ao testar: " + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "🔌 Testar Conexão";
  }
}

async function saveEmailSettings() {
  const statusEl = document.getElementById("email-status");
  const user = document.getElementById("smtp-user").value.trim();
  const pass = document.getElementById("smtp-pass").value;
  const host = document.getElementById("smtp-host").value.trim();
  const port = document.getElementById("smtp-port").value;

  if (!user) {
    statusEl.className = "modal-status error";
    statusEl.textContent = "❌ Informe seu e-mail institucional.";
    return;
  }

  try {
    const result = await api("/api/email-settings", {
      method: "PUT",
      body: JSON.stringify({
        userId: state.selectedUserId,
        user,
        pass: pass || undefined,
        host,
        port: Number(port),
        defaultFrom: user
      })
    });

    if (result.ok) {
      statusEl.className = "modal-status success";
      statusEl.textContent = "✅ Configuração salva com sucesso! Você já pode enviar e-mails.";
    }
  } catch (e) {
    statusEl.className = "modal-status error";
    statusEl.textContent = "❌ Erro ao salvar: " + e.message;
  }
}

// Fechar modal ao clicar fora
document.getElementById("email-settings-modal")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) closeEmailSettings();
});
