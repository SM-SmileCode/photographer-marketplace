import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthTranslation } from "../i18n/useAuthTranslation";
import {
  confirmContactVerification,
  requestContactVerification,
  signupUser,
} from "../services/userService";
import PasswordStrengthIndicator from "../_components/PasswordStrengthIndicator";

function SignUp() {
  const { t } = useAuthTranslation();
  const [user, setUser] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailVerification, setEmailVerification] = useState({
    requestId: "",
    code: "",
    token: "",
    verified: false,
    busy: false,
    devCode: "",
    message: "",
  });

  const navigate = useNavigate();

  const handleInput = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
    if (name === "email") {
      setEmailVerification({ requestId: "", code: "", token: "", verified: false, busy: false, devCode: "", message: "" });
    }
  };

  const handleRequestEmailVerification = async () => {
    if (!user.email.trim()) {
      setErrorMessage("Please enter your email first.");
      return;
    }
    setErrorMessage("");
    setEmailVerification((prev) => ({ ...prev, busy: true, message: "" }));
    try {
      const result = await requestContactVerification({ channel: "email", value: user.email, purpose: "signup" });
      setEmailVerification({
        requestId: result?.verificationRequestId || "",
        code: "",
        token: "",
        verified: false,
        busy: false,
        devCode: result?.devCode || "",
        message: "Verification code sent to your email.",
      });
    } catch (error) {
      setErrorMessage(error?.message || "Failed to send verification code.");
      setEmailVerification((prev) => ({ ...prev, busy: false }));
    }
  };

  const handleConfirmEmailVerification = async () => {
    if (!emailVerification.requestId) {
      setErrorMessage("Please request a verification code first.");
      return;
    }
    if (!emailVerification.code || emailVerification.code.length !== 6) {
      setErrorMessage("Please enter the 6-digit verification code.");
      return;
    }
    setErrorMessage("");
    setEmailVerification((prev) => ({ ...prev, busy: true, message: "" }));
    try {
      const result = await confirmContactVerification({
        verificationRequestId: emailVerification.requestId,
        code: emailVerification.code,
      });
      setEmailVerification((prev) => ({
        ...prev,
        token: result?.verificationToken || "",
        verified: true,
        busy: false,
        message: "Email verified successfully.",
      }));
    } catch (error) {
      setErrorMessage(error?.message || "Invalid verification code.");
      setEmailVerification((prev) => ({ ...prev, busy: false }));
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!user.name || !user.email || !user.phone || !user.password) {
      setErrorMessage(t("auth.fillAllFields"));
      return;
    }
    if (user.password !== user.confirmPassword) {
      setErrorMessage(t("auth.passwordMismatch"));
      return;
    }
    const hasLower = /[a-z]/.test(user.password);
    const hasUpper = /[A-Z]/.test(user.password);
    const hasNumber = /[0-9]/.test(user.password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(user.password);
    if (user.password.length < 8 || !hasLower || !hasUpper || !hasNumber || !hasSymbol) {
      setErrorMessage("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.");
      return;
    }
    if (!emailVerification.verified || !emailVerification.token) {
      setErrorMessage("Please verify your email before creating account.");
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const signupPayload = {
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: user.password,
        role: user.role || undefined,
        emailVerificationToken: emailVerification.token,
      };

      await Promise.race([
        signupUser(signupPayload),
        new Promise((_, reject) =>
          setTimeout(() => {
            reject(
              new Error(
                "Signup request timed out. Please check your internet/server and try again.",
              ),
            );
          }, 15000),
        ),
      ]);
      navigate("/login");
    } catch (error) {
      setErrorMessage(error?.message || t("auth.networkError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-10 text-[var(--text)] sm:px-6 lg:px-8"
      style={{
        "--bg": "#F5F2EA",
        "--surface": "#FFFCF6",
        "--text": "#1F2937",
        "--muted": "#6B7280",
        "--line": "#E7E1D4",
        "--accent": "#0F766E",
        "--accent-hover": "#0B5E58",
      }}
    >
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_20px_60px_-35px_rgba(31,41,55,0.35)] md:grid-cols-2">
        <section className="relative hidden border-r border-[var(--line)] bg-gradient-to-br from-[#FFFCF6] to-[#F1E8D6] p-10 md:block">
          <div className="absolute -left-10 bottom-10 h-36 w-36 rounded-full bg-[#D9C9A5]/45 blur-2xl" />
          <p className="inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
            {t("auth.joinMarketplace")}
          </p>
          <h1 className="mt-5 font-[Georgia,Times,'Times_New_Roman',serif] text-4xl leading-tight">
            {t("auth.signupTitle")}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--muted)]">
            {t("auth.signupSubtitle")}
          </p>
          <div className="mt-8 space-y-3 text-sm">
            <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              {t("auth.signupBenefit1")}
            </p>
            <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              {t("auth.signupBenefit2")}
            </p>
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mb-8 md:hidden">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
              {t("auth.joinMarketplace")}
            </p>
            <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl leading-tight">
              {t("auth.signupFormTitle")}
            </h1>
          </div>

          <form onSubmit={createUser} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-semibold text-[var(--text)]">
                {t("auth.fullName")}
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={user.name}
                onChange={handleInput}
                placeholder={t("auth.fullNamePlaceholder")}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[var(--text)]">
                  {t("auth.emailAddress")}
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={user.email}
                  onChange={handleInput}
                  placeholder={t("auth.emailPlaceholder")}
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRequestEmailVerification}
                    disabled={emailVerification.busy}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold transition hover:bg-[#F2EEDF] disabled:opacity-60"
                  >
                    Send Email Code
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailVerification.code}
                    onChange={(e) =>
                      setEmailVerification((prev) => ({
                        ...prev,
                        code: e.target.value.replace(/\D/g, ""),
                        verified: false,
                        token: "",
                      }))
                    }
                    placeholder="6-digit code"
                    className="w-32 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmEmailVerification}
                    disabled={emailVerification.busy}
                    className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                  >
                    Verify
                  </button>
                </div>
                {emailVerification.message ? (
                  <p className="mt-1 text-xs text-emerald-700">{emailVerification.message}</p>
                ) : null}
                {emailVerification.devCode ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">Dev code: {emailVerification.devCode}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-[var(--text)]">
                  {t("auth.mobileNumber")}
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={user.phone}
                  onChange={handleInput}
                  placeholder={t("auth.mobilePlaceholder")}
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[var(--text)]">
                  {t("auth.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={user.password}
                  onChange={handleInput}
                  placeholder="Create password"
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20"
                />
                <PasswordStrengthIndicator password={user.password} />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-[var(--text)]">
                  {t("auth.confirmPassword")}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  value={user.confirmPassword}
                  onChange={handleInput}
                  placeholder={t("auth.confirmPasswordPlaceholder")}
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="role" className="mb-2 block text-sm font-semibold text-[var(--text)]">
                {t("auth.registerAs")}
              </label>
              <select
                id="role"
                name="role"
                value={user.role}
                onChange={handleInput}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20"
              >
                <option value="">{t("auth.selectRole")}</option>
                <option value="customer">{t("auth.customer")}</option>
                <option value="photographer">{t("auth.photographer")}</option>
              </select>
            </div>

            {errorMessage ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? t("auth.creatingAccount") : t("auth.signupButton")}
            </button>

            <p className="text-center text-sm text-[var(--muted)]">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link to="/login" className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]">
                {t("auth.loginLink")}
              </Link>
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}

export default SignUp;
