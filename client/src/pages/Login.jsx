import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthTranslation } from "../i18n/useAuthTranslation";
import { loginUser as loginUserRequest } from "../services/userService";
import { signInWithGoogle, loginWithGoogleToken } from "../services/googleAuthService";

function Login() {
  const { t } = useAuthTranslation();
  const [loginForm, setLoginForm] = useState({ email: "", password: "", rememberMe: false });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  const safeRedirect = redirect && redirect.startsWith("/") ? redirect : "";
  const navigate = useNavigate();

  const handleLogin = (e) => {
    const { name, value, type, checked } = e.target;
    setLoginForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleLoginUser = async (e) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const data = await loginUserRequest({
        email: loginForm.email,
        password: loginForm.password,
        rememberMe: loginForm.rememberMe,
      });
      let defaultPath = "/dashboard";
      if (data.user.role === "admin") defaultPath = "/admin";
      if (data.user.role === "photographer") defaultPath = "/photographer/dashboard";
      navigate(safeRedirect || defaultPath, { replace: true });
    } catch (error) {
      setErrorMessage(error?.message || t("auth.networkError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage("");
    setGoogleLoading(true);
    try {
      const { idToken } = await signInWithGoogle();
      const data = await loginWithGoogleToken(idToken);
      let defaultPath = "/dashboard";
      if (data.user?.role === "admin") defaultPath = "/admin";
      if (data.user?.role === "photographer") defaultPath = "/photographer/dashboard";
      navigate(safeRedirect || defaultPath, { replace: true });
    } catch (error) {
      setErrorMessage(error?.message || "Google login failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-10 text-[var(--text)] sm:px-6 lg:px-8"
      style={{
        "--bg": "#F5F2EA", "--surface": "#FFFCF6", "--text": "#1F2937",
        "--muted": "#6B7280", "--line": "#E7E1D4", "--accent": "#0F766E", "--accent-hover": "#0B5E58",
      }}
    >
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_20px_60px_-35px_rgba(31,41,55,0.35)] md:grid-cols-2">
        <section className="relative hidden border-r border-[var(--line)] bg-gradient-to-br from-[#FFFCF6] to-[#F1E8D6] p-10 md:block">
          <div className="absolute -right-14 top-16 h-36 w-36 rounded-full bg-[#C7E5E2]/50 blur-2xl" />
          <p className="inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
            {t("auth.welcomeBack")}
          </p>
          <h1 className="mt-5 font-[Georgia,Times,'Times_New_Roman',serif] text-4xl leading-tight">
            {t("auth.loginTitle")}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--muted)]">
            {t("auth.loginSubtitle")}
          </p>
          <div className="mt-8 space-y-3 text-sm">
            <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">{t("auth.loginBenefit1")}</p>
            <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">{t("auth.loginBenefit2")}</p>
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mb-8 md:hidden">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">{t("auth.welcomeBack")}</p>
            <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl leading-tight">{t("auth.loginFormTitle")}</h1>
          </div>

          <form onSubmit={handleLoginUser} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[var(--text)]">{t("auth.emailAddress")}</label>
              <input id="email" type="email" name="email" value={loginForm.email} onChange={handleLogin}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20" />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[var(--text)]">{t("auth.password")}</label>
              <input id="password" type="password" name="password" value={loginForm.password} onChange={handleLogin}
                placeholder={t("auth.passwordPlaceholder")}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
                <input type="checkbox" name="rememberMe" checked={Boolean(loginForm.rememberMe)} onChange={handleLogin} />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]">
                Forgot password?
              </Link>
            </div>

            {errorMessage ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
            ) : null}

            <button type="submit" disabled={isSubmitting || googleLoading}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-70">
              {isSubmitting ? t("auth.loggingIn") : t("auth.loginButton")}
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-[var(--line)]" />
              <span className="text-xs text-[var(--muted)]">or</span>
              <div className="flex-1 border-t border-[var(--line)]" />
            </div>

            <button type="button" onClick={handleGoogleLogin} disabled={isSubmitting || googleLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[#F5F2EA] disabled:opacity-70">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {googleLoading ? "Signing in..." : "Continue with Google"}
            </button>

            <p className="text-center text-sm text-[var(--muted)]">
              {t("auth.newHere")}{" "}
              <Link to="/signup" className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]">
                {t("auth.createAccount")}
              </Link>
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Login;
