import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Layout } from '../components/Layout';
import { ReportView } from '../components/ReportView';
import { clientMeta, postLead, postTeaser, track, type TeaserResult } from '../api';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const SHARE_URL = 'truly.dating';

type Teaser = TeaserResult;

/**
 * Puerta falsa (SPEC §12): intake de screenshots → teaser gratis → precio → captura de correo.
 * NUNCA pide tarjeta ni simula un cobro; declara con transparencia que los pagos no están activos.
 */
export function FakeDoor({ priceAb }: { priceAb: boolean }) {
  // Precio A/B (§12.1.5): la variante mostrada se respeta al abrir pagos.
  const [variant] = useState<'A' | 'B'>(() =>
    priceAb ? (Math.random() < 0.5 ? 'A' : 'B') : 'A',
  );
  const price = variant === 'B' ? 19.99 : 14.99;

  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [teaser, setTeaser] = useState<Teaser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [captured, setCaptured] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  function onFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list);
    const bad = files.find((f) => !ACCEPTED.includes(f.type));
    if (bad) return setError(`"${bad.name}" no es una imagen válida (PNG, JPG o WEBP).`);
    setError(null);
    setScreenshots(files.slice(0, 10));
  }

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (screenshots.length < 1) return setError('Sube al menos un screenshot de tu perfil.');
    const form = new FormData();
    screenshots.forEach((s) => form.append('screenshots', s));
    const meta = clientMeta();
    if (meta.source) form.append('source', meta.source);
    form.append('device', meta.device);
    if (meta.country) form.append('country', meta.country);
    setLoading(true);
    setError(null);
    try {
      setTeaser(await postTeaser(form));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function onUnlock() {
    track('unlock_clicked', { variant }); // métrica de intención (§12.2.1)
    setModalOpen(true);
  }

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    try {
      const meta = clientMeta();
      await postLead({
        email,
        teaserId: teaser?.teaserId,
        teaserScore: teaser?.score ?? 0,
        priceShown: price,
        variant,
        source: meta.source,
        country: meta.country,
      });
      setCaptured(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onShare() {
    const text = `My dating profile scored ${(teaser!.score / 10).toFixed(1)}/10 😬 — get yours: ${SHARE_URL}`;
    try {
      if (navigator.share) {
        await navigator.share({ text, url: `https://${SHARE_URL}?utm_source=share` });
      } else {
        await navigator.clipboard.writeText(text);
        setShareMsg('Copied to clipboard!');
        setTimeout(() => setShareMsg(null), 2500);
      }
    } catch {
      /* usuario canceló el share */
    }
  }

  // ---- Paso 1: intake de screenshots ----
  if (!teaser) {
    return (
      <Layout>
        <form onSubmit={onAnalyze} className="mk-form">
          <div className="mk-form-head">
            <h1>Get your free score in 20 seconds</h1>
            <p>Screenshot your dating profile and see how it really scores — free, no signup.</p>
          </div>
          <div className="mk-group">
            <span className="glabel">Upload screenshots of your profile (1–10)</span>
            <div className="mk-dropzone">
              <input
                type="file"
                multiple
                accept={ACCEPTED.join(',')}
                onChange={(e) => onFiles(e.target.files)}
                className="mk-file"
              />
              <p className="mk-hint">
                Screenshots of your own profile — the preview view. PNG, JPG or WEBP.
              </p>
              {screenshots.length > 0 && (
                <p className="mk-count">{screenshots.length} screenshot(s) selected</p>
              )}
            </div>
          </div>
          {error && <p className="mk-error">{error}</p>}
          <button type="submit" disabled={loading} className="mk-btn" style={{ alignSelf: 'flex-start' }}>
            {loading ? 'Reading your profile…' : 'Get my free score'}
          </button>
        </form>
      </Layout>
    );
  }

  // ---- Paso 2: teaser + vista bloqueada + precio + captura ----
  return (
    <Layout>
      <ReportView
        locked
        lockedInfo={{
          score: teaser.score,
          photoCount: teaser.photoCount,
          problemCount: teaser.problemCount,
        }}
        title="Your full report"
        banner={
          <div className="mk-teaser-banner">
            <div className="mk-teaser-score">
              <div className="big">
                {(teaser.score / 10).toFixed(1)}
                <span>/10</span>
              </div>
              <p className="mk-eyebrow" style={{ margin: 0 }}>
                Your score · could reach {(teaser.potentialScore / 10).toFixed(1)}
              </p>
            </div>
            <div className="mk-cat-chips">
              <CatChip label="Photos" c={teaser.categoryScores.photos} />
              <CatChip label="Bio" c={teaser.categoryScores.bio} />
              <CatChip label="Prompts" c={teaser.categoryScores.prompts} />
            </div>
            <div className="mk-card mk-teaser-card">
              <p className="win">✦ {teaser.strength}</p>
              <p className="pen">
                But we found <b>{teaser.problemCount} problems</b> pushing matches away — all fixable.
                Here&apos;s your full report:
              </p>
            </div>
          </div>
        }
        footer={
          <div className="mk-teaser-unlock">
            <div className="mk-cta-row" style={{ justifyContent: 'center' }}>
              <button type="button" className="mk-btn mk-hide-mobile" onClick={onUnlock}>
                Unlock my full report — ${price.toFixed(2)}
              </button>
              <button type="button" className="mk-btn ghost" onClick={onShare}>
                Share my score
              </button>
            </div>
            <p className="mk-hint">Premium plan adds 30 brand-new AI photos of you.</p>
            {shareMsg && (
              <span className="mk-count" style={{ color: 'var(--win)' }}>{shareMsg}</span>
            )}
          </div>
        }
      />

      {/* CTA sticky en móvil (SPEC §12.1.2b): portal a body para que el fixed se ancle
          al viewport sin importar ancestros con transform/filter. */}
      {createPortal(
        <div className="mk-sticky-cta">
          <button type="button" className="mk-btn" onClick={onUnlock}>
            Unlock my full report — ${price.toFixed(2)}
          </button>
        </div>,
        document.body,
      )}

      {/* Modal de captura — NUNCA pide tarjeta (§12.1.3) */}
      {modalOpen && (
        <div className="mk-modal-overlay" onClick={() => !captured && setModalOpen(false)}>
          <div className="mk-modal" onClick={(e) => e.stopPropagation()}>
            {captured ? (
              <>
                <h3>You&apos;re on the list 🎉</h3>
                <p>We&apos;ll email you the moment it&apos;s live — with your 30% launch discount.</p>
                <button type="button" className="mk-btn" onClick={() => setModalOpen(false)}>
                  Done
                </button>
              </>
            ) : (
              <>
                <h3>We&apos;re switching payments on right now</h3>
                <p>
                  Leave your email and you&apos;ll be among the first in — with <b>30% off</b> at launch.
                </p>
                <form onSubmit={onSubmitEmail} className="mk-modal-form">
                  <input
                    type="email"
                    required
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mk-input"
                  />
                  <button type="submit" className="mk-btn">Get early access</button>
                </form>
                {error && <p className="mk-error">{error}</p>}
                <p className="mk-hint" style={{ fontSize: '.78rem' }}>
                  No card required. We&apos;ll only email you about your report.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

/** Chip de subscore por categoría (SPEC §5.1.2c): score + conteo real de sugerencias. */
function CatChip({ label, c }: { label: string; c: { score: number; suggestions: number } }) {
  return (
    <div className="mk-cat-chip">
      <span className="lbl">{label}</span>
      <span className="sc">{c.score}</span>
      <span className="sug">
        {c.suggestions} {c.suggestions === 1 ? 'suggestion' : 'suggestions'}
      </span>
    </div>
  );
}
