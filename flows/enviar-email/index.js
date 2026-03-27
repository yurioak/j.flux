const fs = require("fs");
const path = require("path");
const { sendEmail } = require("../../actions/email");
const { logger } = require("../../runner/logger");

/**
 * Fluxo: Enviar E-mail
 * 
 * Responsabilidade: Orquestrar o envio de e-mails institucionais.
 * - Renderiza templates com variáveis de contexto.
 * - Delega o envio ao adaptador de e-mail (baixo acoplamento).
 * - Registra o resultado para auditoria.
 */

/**
 * Renderiza um template HTML substituindo placeholders {{variavel}}.
 * Suporta blocos condicionais simples {{#variavel}}...{{/variavel}}.
 */
function renderTemplate(templateName, vars) {
  const templatePath = path.join(__dirname, "templates", `${templateName}.html`);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template de e-mail não encontrado: ${templateName}`);
  }

  let html = fs.readFileSync(templatePath, "utf8");

  // Processa blocos condicionais {{#campo}}conteudo{{/campo}}
  for (const [key, value] of Object.entries(vars)) {
    const blockRegex = new RegExp(`\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, "g");
    if (value && String(value).trim()) {
      // Mantém o conteúdo do bloco
      html = html.replace(blockRegex, "$1");
    } else {
      // Remove o bloco inteiro
      html = html.replace(blockRegex, "");
    }
  }

  // Substitui variáveis simples {{variavel}}
  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }

  return html;
}

/**
 * Gera o texto puro a partir das variáveis (fallback para clientes sem HTML).
 */
function generatePlainText(vars) {
  const lines = [
    `Assunto: ${vars.assunto || ""}`,
    "",
    `Prezado(a),`,
    "",
  ];

  if (vars.processo) {
    lines.push(`Processo: ${vars.processo}`);
  }
  if (vars.unidade) {
    lines.push(`Unidade: ${vars.unidade}`);
  }
  if (vars.mensagem) {
    lines.push("", vars.mensagem);
  }

  lines.push(
    "",
    "---",
    `Enviado automaticamente por J.Flow RPA Platform em ${vars.data}`,
    `Remetente: ${vars.responsavel || "Sistema"}`
  );

  return lines.join("\n");
}

/**
 * Resolve o endereço de remetente (from) com base na configuração do perfil.
 */
function resolveFrom(context) {
  const remetenteType = context.input.remetente || "pessoal";
  const emailConfig = context.settings.email || {};
  
  if (remetenteType === "compartilhada" && context.input.caixaCompartilhada) {
    return context.input.caixaCompartilhada;
  }

  if (remetenteType === "compartilhada" && emailConfig.sharedMailboxes?.length > 0) {
    return emailConfig.sharedMailboxes[0].address;
  }

  return emailConfig.defaultFrom || emailConfig.smtp?.user || null;
}

async function runFlow(context) {
  const templateId = context.input.template || "comunicado-interno";
  const destinatario = context.input.destinatario || "";
  const assunto = context.input.assunto || "";

  // ── Validações de entrada ──────────────────────────
  if (!destinatario) {
    throw new Error("Informe o destinatário do e-mail.");
  }
  if (!assunto) {
    throw new Error("Informe o assunto do e-mail.");
  }

  const vars = buildTemplateVars(context);
  const html = renderTemplate(templateId, vars);
  const text = generatePlainText(vars);
  const from = resolveFrom(context);

  // ── Dry Run ────────────────────────────────────────
  if (context.dryRun) {
    return {
      status: "dry-run",
      message: `Teste local concluído. Template '${templateId}' renderizado com sucesso para ${destinatario}.`,
      preview: html.substring(0, 500) + "..."
    };
  }

  // ── Decisão de Motor (SMTP vs RPA) ──────────────────
  const smtpConfig = context.settings.email?.smtp;
  const hasSmtp = smtpConfig && smtpConfig.user && smtpConfig.pass && smtpConfig.pass !== "SUA-SENHA-DE-APP-AQUI";

  if (hasSmtp) {
    context.reportProgress({
      message: `Tentando envio invisível via SMTP (${smtpConfig.user})...`,
      phase: "send-email",
      status: "running"
    });

    const result = await sendEmail(
      { to: destinatario, subject: assunto, html, text, from, cc: context.input.cc || null },
      smtpConfig
    );

    if (result.ok) {
      logger.info(`E-mail enviado via SMTP com sucesso`);
      context.reportProgress({
        message: `E-mail enviado com sucesso para ${destinatario} (via SMTP).`,
        phase: "send-email",
        status: "finished"
      });
      return {
        status: "email-sent",
        message: `E-mail enviado com sucesso para ${destinatario} (via SMTP).`,
        messageId: result.messageId,
        method: "smtp",
        from,
        to: destinatario,
        template: templateId
      };
    }
    
    logger.warn(`Falha no SMTP: ${result.error}. Tentando fallback para Navegador...`);
  } else {
    logger.info("Configuração SMTP não encontrada ou incompleta. Tentando envio via Navegador...");
  }

  // ── Fallback RPA (Navegador) ────────────────────────
  context.reportProgress({
    message: `Iniciando navegador para envio via Outlook Web (Fricção Zero)...`,
    phase: "send-email-rpa",
    status: "running"
  });

  const rpaResult = await sendOutlookEmail(
    { to: destinatario, subject: assunto, html, text },
    { userId: context.userId, reportProgress: context.reportProgress }
  );

  if (!rpaResult.ok) {
    logger.error(`Falha no envio via Navegador: ${rpaResult.error}`);
    return {
      status: "email-failed",
      message: `Não foi possível enviar o e-mail. Erro: ${rpaResult.error}`,
      method: "rpa-outlook"
    };
  }

  context.reportProgress({
    message: `E-mail enviado com sucesso para ${destinatario} (via Navegador).`,
    phase: "send-email-rpa",
    status: "finished"
  });

  return {
    status: "email-sent",
    message: `E-mail enviado com sucesso para ${destinatario}. MessageID: ${result.messageId}`,
    messageId: result.messageId,
    from,
    to: destinatario,
    template: templateId
  };
}

/**
 * Constrói as variáveis de template a partir do contexto da execução.
 */
function buildTemplateVars(context) {
  return {
    processo: context.input.processo || "",
    unidade: context.user?.unit || context.input.unidade || "Não informada",
    responsavel: context.user?.displayName || context.input.responsavel || "Sistema J.Flow",
    mensagem: context.input.mensagem || "",
    assunto: context.input.assunto || "",
    data: new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeStyle: "short"
    }).format(new Date())
  };
}

module.exports = { runFlow };
