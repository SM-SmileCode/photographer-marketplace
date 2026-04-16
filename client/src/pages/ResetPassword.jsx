import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../services/userService";
import PasswordStrengthIndicator from "../_components/PasswordStrengthIndicator";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setError("Missing reset token. Please reopen the reset link from your email.");
      return;
    }

    const hasLower = /[a-z]/.test(form.password);
    const hasUpper = /[A-Z]/.test(form.password);
    const hasNumber = /[0-9]/.test(form.password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(form.password);
    if (form.password.length < 8 || !hasLower || !hasUpper || !hasNumber || !hasSymbol) {
      setError("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await resetPassword({
        token,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      setMessage(result?.message || "Password reset successful.");
      setForm({ password: "", confirmPassword: "" });
    } catch (submitError) {
      setError(submitError?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
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
      <div className="mx-auto max-w-xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8">
        <h1 className="font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
          Reset Password
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Enter your new password to complete reset.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="reset-password"
              className="mb-2 block text-sm font-semibold text-[var(--text)]"
            >
              New Password
            </label>
            <input
              id="reset-password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              minLength={8}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20"
              required
            />
            <PasswordStrengthIndicator password={form.password} />
          </div>

          <div>
            <label
              htmlFor="reset-confirm-password"
              className="mb-2 block text-sm font-semibold text-[var(--text)]"
            >
              Confirm New Password
            </label>
            <input
              id="reset-confirm-password"
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              minLength={8}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20"
              required
            />
          </div>

          {message ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {loading ? "Updating..." : "Reset password"}
          </button>

          <p className="text-center text-sm text-[var(--muted)]">
            Back to{" "}
            <Link
              to="/login"
              className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
