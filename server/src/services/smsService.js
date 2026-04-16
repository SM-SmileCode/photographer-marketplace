const DEFAULT_SMS_PROVIDER = "console";

function getSmsConfig() {
  return {
    provider: String(process.env.SMS_PROVIDER || DEFAULT_SMS_PROVIDER).trim(),
    sender: String(process.env.SMS_SENDER || "ShotSphere").trim(),
  };
}

export async function sendSms({ to, message }) {
  const phone = String(to || "").trim();
  const text = String(message || "").trim();

  if (!phone) {
    return { sent: false, reason: "missing_phone" };
  }

  if (!text) {
    return { sent: false, reason: "missing_message" };
  }

  const config = getSmsConfig();

  if (config.provider === "console" || process.env.NODE_ENV !== "production") {
    console.log("[sms]", { to: phone, message: text, sender: config.sender });
    return { sent: true, provider: config.provider };
  }

  return {
    sent: false,
    reason: "sms_provider_not_configured",
    provider: config.provider,
  };
}
