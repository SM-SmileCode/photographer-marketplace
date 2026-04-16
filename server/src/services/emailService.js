const DEFAULT_FRONTEND_URL = "http://localhost:5173";
let cachedTransporter = null;
let attemptedTransporterInit = false;

function getEmailConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@shotsphere.local";

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
    from,
  };
}

async function getTransporter() {
  if (attemptedTransporterInit) {
    return cachedTransporter;
  }

  attemptedTransporterInit = true;
  const config = getEmailConfig();
  if (!config) {
    cachedTransporter = null;
    return null;
  }

  try {
    const nodemailerModule = await import("nodemailer");
    const nodemailer = nodemailerModule?.default || nodemailerModule;
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
    return cachedTransporter;
  } catch (error) {
    console.warn(
      "[email] nodemailer unavailable. Install nodemailer to enable email delivery.",
      error?.message || error,
    );
    cachedTransporter = null;
    return null;
  }
}

export function getFrontendBaseUrl() {
  const envUrl = String(process.env.FRONTEND_URL || "").trim();
  return envUrl || DEFAULT_FRONTEND_URL;
}

export async function sendEmail({ to, subject, text, html }) {
  if (!to || typeof to !== "string") {
    return { sent: false, reason: "missing_recipient" };
  }

  const config = getEmailConfig();
  if (!config) {
    return { sent: false, reason: "email_not_configured" };
  }

  const transporter = await getTransporter();
  if (!transporter) {
    return { sent: false, reason: "transporter_unavailable" };
  }

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject: subject || "ShotSphere Notification",
      text: text || "",
      html: html || undefined,
    });

    return { sent: true };
  } catch (error) {
    console.error("[email] send failed", error);
    return {
      sent: false,
      reason: "send_failed",
      error: error?.message || "Unknown email send error",
    };
  }
}
