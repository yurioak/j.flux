const nodemailer = require("nodemailer");

/**
 * Adaptador de E-mail — Responsabilidade Única: enviar e-mails via SMTP.
 * 
 * Princípios:
 * - Baixo acoplamento: não conhece fluxos, templates ou contexto de execução.
 * - Alta coesão: toda lógica SMTP vive aqui.
 * - Interoperabilidade: aceita qualquer configuração SMTP (Office 365, Gmail, relay interno).
 */

/**
 * Valida a configuração mínima de SMTP.
 * @param {object} config - { host, port, user, pass }
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSmtpConfig(config) {
  const errors = [];
  if (!config) errors.push("Configuração SMTP ausente.");
  if (!config?.host) errors.push("host SMTP não informado.");
  if (!config?.port) errors.push("port SMTP não informado.");
  if (!config?.user) errors.push("user SMTP não informado.");
  if (!config?.pass) errors.push("pass SMTP não informado.");
  return { valid: errors.length === 0, errors };
}

/**
 * Cria um transporter Nodemailer a partir da configuração.
 * @param {object} smtpConfig - { host, port, secure, user, pass }
 * @returns {import("nodemailer").Transporter}
 */
function createTransporter(smtpConfig) {
  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: Number(smtpConfig.port),
    secure: smtpConfig.secure === true, // false = STARTTLS (padrão Office 365)
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    },
    tls: {
      // Necessário para ambientes corporativos com certificados internos
      rejectUnauthorized: false
    }
  });
}

/**
 * Envia um e-mail.
 * 
 * @param {object} options
 * @param {string} options.to - Destinatário(s), separados por vírgula
 * @param {string} options.subject - Assunto do e-mail
 * @param {string} [options.html] - Corpo HTML do e-mail
 * @param {string} [options.text] - Corpo texto puro (fallback)
 * @param {string} [options.from] - Remetente (se diferente do user SMTP)
 * @param {string} [options.cc] - Cópia
 * @param {string} [options.bcc] - Cópia oculta
 * @param {object} smtpConfig - Configuração SMTP do perfil do usuário
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
 */
async function sendEmail(options, smtpConfig) {
  // Validação de inputs
  const validation = validateSmtpConfig(smtpConfig);
  if (!validation.valid) {
    return { ok: false, error: `Configuração SMTP inválida: ${validation.errors.join("; ")}` };
  }

  if (!options.to) {
    return { ok: false, error: "Destinatário não informado." };
  }

  if (!options.subject) {
    return { ok: false, error: "Assunto não informado." };
  }

  if (!options.html && !options.text) {
    return { ok: false, error: "Corpo do e-mail vazio (html ou text é obrigatório)." };
  }

  const transporter = createTransporter(smtpConfig);

  const mailOptions = {
    from: options.from || smtpConfig.user,
    to: options.to,
    subject: options.subject,
    ...(options.html && { html: options.html }),
    ...(options.text && { text: options.text }),
    ...(options.cc && { cc: options.cc }),
    ...(options.bcc && { bcc: options.bcc })
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      code: err.code || null
    };
  } finally {
    transporter.close();
  }
}

/**
 * Testa a conexão SMTP sem enviar e-mail.
 * @param {object} smtpConfig
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function testConnection(smtpConfig) {
  const validation = validateSmtpConfig(smtpConfig);
  if (!validation.valid) {
    return { ok: false, error: validation.errors.join("; ") };
  }

  const transporter = createTransporter(smtpConfig);

  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    transporter.close();
  }
}

module.exports = {
  sendEmail,
  testConnection,
  validateSmtpConfig
};
