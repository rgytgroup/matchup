import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

type Theme = 'light' | 'dark';

/** Aplica y persiste el tema; respeta la preferencia del sistema por defecto. */
function useTheme(): [Theme | null, () => void] {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('mk-theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
      setTheme(stored);
    }
  }, []);

  function toggle() {
    const current: Theme =
      theme ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('mk-theme', next);
    setTheme(next);
  }

  return [theme, toggle];
}

export function Layout({ children }: { children: ReactNode }) {
  const t = useI18n();
  const [, toggleTheme] = useTheme();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mk-header">
        <div className="mk-wrap mk-header-inner">
          <Link to="/" className="mk-brand">
            {t.common.appName}
            <span className="dot" aria-hidden="true" />
          </Link>
          <nav className="mk-nav">
            <a className="link mk-hide-sm" href="/#report">
              The report
            </a>
            <a className="link mk-hide-sm" href="/#pricing">
              {t.nav.pricing}
            </a>
            <a className="link mk-hide-sm" href="/#faq">
              {t.nav.faq}
            </a>
            <button
              type="button"
              className="mk-theme"
              onClick={toggleTheme}
              aria-label="Toggle light or dark theme"
            >
              ◐
            </button>
            <Link to="/start" className="mk-btn sm">
              {t.nav.startCta}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mk-footer">
        <div className="mk-wrap mk-footer-inner">
          <span>© {new Date().getFullYear()} rgytgroup · {t.common.appName}</span>
          <nav>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/refunds">Refunds</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
