import { useLanguage } from "../context/LanguageContext";

const LANGUAGES = [{ code: "en", label: "EN", full: "English" }];

function LanguageSwitcher({ className = "" }) {
  const { lang, setLang } = useLanguage();

  return (
    <div className={`flex items-center gap-1 rounded-full border border-[#E7E1D4] bg-white p-0.5 ${className}`}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          title={l.full}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            lang === l.code
              ? "bg-[#0F766E] text-white"
              : "text-[#6B7280] hover:text-[#1F2937]"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
