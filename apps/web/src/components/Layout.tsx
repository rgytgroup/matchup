import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export function Layout({ children }: { children: ReactNode }) {
  const t = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-bold">
            {t.common.appName}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/#pricing" className="hover:underline">
              {t.nav.pricing}
            </a>
            <a href="/#faq" className="hover:underline">
              {t.nav.faq}
            </a>
            <Link to="/start" className="rounded-full bg-slate-900 px-4 py-1.5 text-white">
              {t.nav.startCta}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-100 text-sm text-slate-500">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6">
          <span>© {new Date().getFullYear()} rgytgroup</span>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:underline">
              Terms
            </Link>
            <Link to="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link to="/refunds" className="hover:underline">
              Refunds
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
