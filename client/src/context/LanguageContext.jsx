import { createContext, useContext, useState } from "react";

const LanguageContext = createContext({ lang: "en", setLang: () => {} });
const SUPPORTED_LANGS = new Set(["en"]);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem("lang");
    if (SUPPORTED_LANGS.has(saved)) return saved;
    localStorage.setItem("lang", "en");
    return "en";
  });

  const handleSetLang = (l) => {
    const nextLang = SUPPORTED_LANGS.has(l) ? l : "en";
    localStorage.setItem("lang", nextLang);
    setLang(nextLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
