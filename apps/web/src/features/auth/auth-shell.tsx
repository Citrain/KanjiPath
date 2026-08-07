import type { ReactNode } from 'react';

const HERO_KANJI = ['漢', '字', '学', '道'];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section
        aria-hidden
        className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <div className="pointer-events-none absolute inset-0">
          {HERO_KANJI.map((kanji, index) => (
            <span
              key={kanji}
              className="font-kanji animate-float absolute select-none font-bold text-ink"
              style={{
                fontSize: `${9 + index * 3}rem`,
                left: `${8 + index * 22}%`,
                top: `${12 + ((index * 23) % 60)}%`,
                opacity: index === 0 ? 0.16 : 0.07,
                animationDelay: `${index * 1.2}s`,
              }}
            >
              {kanji}
            </span>
          ))}
          <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-sky/10 blur-3xl" />
        </div>
        <div className="relative flex items-center gap-3">
          <span className="font-kanji gradient-accent flex h-12 w-12 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-[0_16px_40px_-12px_var(--glow)]">
            漢
          </span>
          <span className="text-2xl font-bold tracking-tight">
            Kanji<span className="gradient-text">Path</span>
          </span>
        </div>
        <div className="relative">
          <p className="font-kanji text-glow text-7xl font-bold leading-tight text-ink">
            一歩ずつ、
            <br />
            漢字の道へ。
          </p>
          <p className="mt-6 max-w-md text-lg text-muted">
            Pas à pas, sur la voie des kanji. Des fiches riches, des exercices variés et une
            répétition espacée qui s'adapte à vous.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <span className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-ink-soft">
              Parcours N5 → N1
            </span>
            <span className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-ink-soft">
              Aligné sur le JLPT
            </span>
            <span className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-ink-soft">
              Sans IA au runtime
            </span>
          </div>
        </div>
        <p className="relative text-xs text-muted">
          Les listes de niveaux ne sont pas officielles : parcours aligné sur le JLPT.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="font-kanji gradient-accent flex h-11 w-11 items-center justify-center rounded-xl text-xl font-bold text-white">
              漢
            </span>
            <span className="text-xl font-bold tracking-tight">
              Kanji<span className="gradient-text">Path</span>
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
