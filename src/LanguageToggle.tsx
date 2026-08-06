import React from "react";

interface Props {
  locale: string;
  onSwitch: (locale: string) => void;
}

// Floating language switcher (日本語 / English). Uses fixed labels so it is
// always legible regardless of the active language.
export function LanguageToggle({ locale, onSwitch }: Props) {
  return (
    <div className="lang-toggle" role="group" aria-label="language">
      <button
        type="button"
        className={locale === "ja" ? "active" : ""}
        onClick={() => onSwitch("ja")}
      >
        日本語
      </button>
      <button
        type="button"
        className={locale === "en" ? "active" : ""}
        onClick={() => onSwitch("en")}
      >
        English
      </button>
    </div>
  );
}
