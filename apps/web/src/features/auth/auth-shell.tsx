import { BookOpenCheck, BrainCircuit, Route } from 'lucide-react';
import type { ReactNode } from 'react';

const FEATURES = [
  { icon: Route, label: 'Parcours N5 → N1' },
  { icon: BookOpenCheck, label: 'Aligné sur le JLPT' },
  { icon: BrainCircuit, label: 'Répétition espacée FSRS' },
];

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
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section
        aria-hidden
        className="relative hidden overflow-hidden border-r border-line bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <div className="pointer-events-none absolute inset-0">
          <span className="font-jp animate-float absolute -right-8 top-16 select-none text-[16rem] font-bold text-ink opacity-[0.045]">
            漢
          </span>
          <span className="font-jp animate-float absolute bottom-24 left-10 select-none text-[7rem] font-bold text-ink opacity-[0.05] [animation-delay:1.4s]">
            道
          </span>
          <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-accent/8 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <span className="font-jp flex size-12 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white shadow-glow">
            漢
          </span>
          <span className="text-2xl font-bold tracking-tight text-ink">
            Kanji<span className="text-accent">Path</span>
          </span>
        </div>

        <div className="relative">
          <p className="font-jp text-6xl font-bold leading-[1.25] text-ink xl:text-7xl">
            一歩ずつ、
            <br />
            漢字の道へ。
          </p>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            Pas à pas, sur la voie des kanji. Des fiches riches, des exercices variés et une
            répétition espacée qui s'adapte à vous.
          </p>
          <ul className="mt-8 flex flex-wrap items-center gap-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <li
                  key={feature.label}
                  className="flex items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm font-semibold text-ink-soft"
                >
                  <Icon aria-hidden className="size-4 text-accent" />
                  {feature.label}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-muted">
          Les listes de niveaux ne sont pas officielles : parcours aligné sur le JLPT.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="font-jp flex size-11 items-center justify-center rounded-xl bg-accent text-xl font-bold text-white shadow-glow">
              漢
            </span>
            <span className="text-xl font-bold tracking-tight text-ink">
              Kanji<span className="text-accent">Path</span>
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-[15px] text-muted">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
