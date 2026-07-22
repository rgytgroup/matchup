import { useState } from 'react';
import { Layout } from '../components/Layout';
import { getFunnel } from '../api';

type Funnel = Awaited<ReturnType<typeof getFunnel>>;

const STEPS: Array<{ key: keyof Funnel['counts']; label: string }> = [
  { key: 'visit', label: 'Visits' },
  { key: 'teaser_viewed', label: 'Saw teaser' },
  { key: 'unlock_clicked', label: 'Clicked unlock' },
  { key: 'email_captured', label: 'Left email' },
];

/**
 * Vista de embudo admin (SPEC §12.2.3): 4 pasos + % de conversión, filtrable por
 * fuente y país. Protegida con ADMIN_TOKEN (no enlazada desde ningún lado).
 */
export function AdminFunnel() {
  const [token, setToken] = useState(() => localStorage.getItem('mk-admin-token') ?? '');
  const [source, setSource] = useState('');
  const [country, setCountry] = useState('');
  const [data, setData] = useState<Funnel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(e?: React.FormEvent) {
    e?.preventDefault();
    if (!token) return setError('Ingresa el ADMIN_TOKEN.');
    setLoading(true);
    setError(null);
    try {
      const res = await getFunnel(token, { source: source.trim(), country: country.trim() });
      setData(res);
      localStorage.setItem('mk-admin-token', token);
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // % de conversión de cada paso respecto al ANTERIOR (visión de embudo).
  function stepPct(i: number): number | null {
    if (!data || i === 0) return null;
    const prev = data.counts[STEPS[i - 1].key] ?? 0;
    const cur = data.counts[STEPS[i].key] ?? 0;
    return prev ? Math.round((cur / prev) * 1000) / 10 : 0;
  }

  const intent = data?.conversion.intent ?? 0;
  const intentReading =
    intent >= 3 ? { txt: 'Validated — ready for ads', color: 'var(--win)' }
    : intent >= 1 ? { txt: 'Grey zone — iterate the teaser/promise', color: 'var(--honey-deep)' }
    : { txt: "Don't pay for ads yet — fix the promise/hook first", color: 'var(--pen)' };

  return (
    <Layout>
      <div className="mk-form">
        <div className="mk-form-head">
          <h1>Funnel</h1>
          <p>Fake-door conversion funnel (SPEC §12.2). Admin only.</p>
        </div>

        <form onSubmit={load} className="mk-group">
          <label className="mk-label">Admin token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mk-input"
            placeholder="ADMIN_TOKEN"
          />
          <div className="mk-optgrid">
            <div>
              <label className="mk-label">Source (optional)</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="mk-input"
                placeholder="tiktok · reddit · share…"
              />
            </div>
            <div>
              <label className="mk-label">Country (optional)</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                className="mk-input"
                placeholder="CO · US · MX…"
                maxLength={2}
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="mk-btn" style={{ alignSelf: 'flex-start' }}>
            {loading ? 'Loading…' : 'Load funnel'}
          </button>
          {error && <p className="mk-error">{error}</p>}
        </form>

        {data && (
          <div className="mk-group">
            <div className="mk-funnel">
              {STEPS.map((s, i) => {
                const count = data.counts[s.key] ?? 0;
                const pct = stepPct(i);
                const isIntent = s.key === 'unlock_clicked';
                return (
                  <div key={s.key} className="mk-funnel-step">
                    {i > 0 && (
                      <div className="mk-funnel-pct">↓ {pct}% <span>from previous</span></div>
                    )}
                    <div className={`mk-funnel-bar${isIntent ? ' intent' : ''}`}>
                      <span className="lbl">{s.label}</span>
                      <span className="val">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mk-card" style={{ marginTop: '1.2rem' }}>
              <div className="mk-funnel-kpi">
                <div>
                  <span className="k">Purchase intent</span>
                  <span className="v" style={{ color: intentReading.color }}>{intent}%</span>
                  <span className="cap">unlock ÷ visits</span>
                </div>
                <div>
                  <span className="k">Email capture</span>
                  <span className="v">{data.conversion.capture}%</span>
                  <span className="cap">email ÷ unlock</span>
                </div>
                <div>
                  <span className="k">Leads</span>
                  <span className="v">{data.leads}</span>
                  <span className="cap">total captured</span>
                </div>
              </div>
              <p className="mk-hint" style={{ marginTop: '.8rem', fontWeight: 600, color: intentReading.color }}>
                {intentReading.txt}
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
