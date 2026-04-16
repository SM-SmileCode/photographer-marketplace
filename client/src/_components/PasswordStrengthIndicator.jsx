function getPasswordStrength(password) {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^a-zA-Z0-9]/.test(password),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const strength = passed <= 2 ? "weak" : passed <= 3 ? "fair" : passed === 4 ? "good" : "strong";
  return { checks, passed, strength };
}

const strengthConfig = {
  weak:   { label: "Weak",   color: "bg-red-500",    text: "text-red-600",    width: "w-1/4" },
  fair:   { label: "Fair",   color: "bg-orange-400", text: "text-orange-600", width: "w-2/4" },
  good:   { label: "Good",   color: "bg-yellow-400", text: "text-yellow-600", width: "w-3/4" },
  strong: { label: "Strong", color: "bg-emerald-500",text: "text-emerald-600",width: "w-full" },
};

function PasswordStrengthIndicator({ password }) {
  if (!password) return null;

  const { checks, strength } = getPasswordStrength(password);
  const config = strengthConfig[strength];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-[var(--line)]">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${config.color} ${config.width}`} />
        </div>
        <span className={`text-xs font-semibold ${config.text}`}>{config.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {[
          { key: "length",    label: "At least 8 characters" },
          { key: "lowercase", label: "Lowercase (a-z)" },
          { key: "uppercase", label: "Uppercase (A-Z)" },
          { key: "number",    label: "Number (0-9)" },
          { key: "symbol",    label: "Symbol (!@#$...)" },
        ].map(({ key, label }) => (
          <p key={key} className={`flex items-center gap-1 text-xs ${checks[key] ? "text-emerald-600" : "text-[var(--muted)]"}`}>
            <span>{checks[key] ? "✓" : "○"}</span>
            {label}
          </p>
        ))}
      </div>
    </div>
  );
}

export default PasswordStrengthIndicator;
