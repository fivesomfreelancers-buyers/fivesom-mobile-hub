import { useEffect, useState } from "react";

import legal from "@/data/legal.json";

export type LegalDocKey = "terms" | "privacy";
export type LegalLang = "en" | "so" | "fr" | "ar";

export const LEGAL_LANGS: { code: LegalLang; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "so", label: "Somali", flag: "🇸🇴" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
];

const LANG_STORAGE_KEY = "fivesom-legal-lang";
const LAST_UPDATED = "15 August 2026";

/** Meta keys that are rendered by the header, not as body sections. */
const META_KEYS = new Set([
  "badge",
  "title",
  "subtitle",
  "updatedLabel",
  "toc",
  "tocItems",
  "backToTerms",
  "contactLink",
]);

type Doc = Record<string, unknown>;

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((it) => (
        <li key={it} className="flex gap-2 text-sm text-muted-foreground">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-pink" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span
          key={it}
          className="rounded-full border border-destructive/25 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive"
        >
          {it}
        </span>
      ))}
    </div>
  );
}

function Cards({ items }: { items: { title?: string; label?: string; desc?: string }[] }) {
  return (
    <div className="mt-3 space-y-2">
      {items.map((c) => (
        <div key={(c.title ?? c.label) as string} className="rounded-xl border border-border bg-card p-3">
          <p className="text-sm font-semibold text-foreground">{c.title ?? c.label}</p>
          {c.desc ? <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p> : null}
        </div>
      ))}
    </div>
  );
}

function Section({ value, fallbackTitle }: { value: unknown; fallbackTitle?: string }) {
  if (Array.isArray(value)) {
    const arr = value as { title?: string; label?: string; desc?: string }[];
    return (
      <section className="pt-4">
        {fallbackTitle ? (
          <h2 className="text-sm font-bold text-foreground">{fallbackTitle}</h2>
        ) : null}
        <Cards items={arr} />
      </section>
    );
  }
  if (!value || typeof value !== "object") return null;
  const s = value as {
    id?: string;
    title?: string;
    body?: string;
    intro?: string;
    items?: string[];
    supportLink?: string;
    privacyLink?: string;
    linkLabel?: string;
  };
  const isProhibited = (s.items?.length ?? 0) > 12;
  return (
    <section id={s.id} className="pt-4">
      {s.title ? <h2 className="text-sm font-bold text-foreground">{s.title}</h2> : null}
      {s.body ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {s.body}
          {s.linkLabel ? (
            <>
              {" "}
              <a href="mailto:noreply@fivesom.net" className="font-medium text-primary">
                {s.linkLabel}
              </a>
            </>
          ) : null}
          {s.supportLink ? (
            <>
              {" "}
              <a href="mailto:noreply@fivesom.net" className="font-medium text-primary">
                {s.supportLink}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {s.intro ? <p className="mt-1.5 text-sm text-muted-foreground">{s.intro}</p> : null}
      {s.items ? isProhibited ? <Chips items={s.items} /> : <Bullets items={s.items} /> : null}
    </section>
  );
}

export function LegalDoc({ doc }: { doc: LegalDocKey }) {
  const [lang, setLang] = useState<LegalLang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY) as LegalLang | null;
    if (saved && LEGAL_LANGS.some((l) => l.code === saved)) setLang(saved);
  }, []);

  function pick(code: LegalLang) {
    setLang(code);
    window.localStorage.setItem(LANG_STORAGE_KEY, code);
  }

  const data = (legal as Record<LegalDocKey, Record<LegalLang, Doc>>)[doc][lang];
  const rtl = lang === "ar";
  const toc = (data['tocItems'] as { id: string; label: string }[] | undefined) ?? [];

  // Titles for the array-shaped sections, which live in sibling *Title keys.
  const arrayTitles: Record<string, string> = {
    consequences: (data['consequencesTitle'] as string) ?? "",
    rights: (data['rightsTitle'] as string) ?? "",
    dataItems: (data['dataCollectedTitle'] as string) ?? "",
    retention: (data['retentionTitle'] as string) ?? "",
  };

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="px-4 pb-10 pt-4">
      <div className="rounded-2xl bg-accent-pink/10 p-5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent-pink">
          {data['badge'] as string}
        </span>
        <h1 className="mt-1 text-lg font-bold text-foreground">{data['title'] as string}</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {data['subtitle'] as string}
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {data['updatedLabel'] as string}: {LAST_UPDATED}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {LEGAL_LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => pick(l.code)}
            aria-pressed={lang === l.code}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              lang === l.code
                ? "border-accent-pink bg-accent-pink text-white"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            <span className="me-1">{l.flag}</span>
            {l.label}
          </button>
        ))}
      </div>

      {toc.length ? (
        <details className="mt-4 rounded-xl border border-border bg-card p-3">
          <summary className="cursor-pointer text-sm font-semibold">{data['toc'] as string}</summary>
          <ul className="mt-2 space-y-1">
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="text-xs text-muted-foreground hover:text-primary">
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <article className="divide-y divide-border">
        {Object.entries(data)
          .filter(([k]) => !META_KEYS.has(k) && !k.endsWith("Title"))
          .map(([k, v]) => (
            <Section key={k} value={v} {...(arrayTitles[k] ? { fallbackTitle: arrayTitles[k] } : {})} />
          ))}
      </article>
    </div>
  );
}
