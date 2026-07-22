import type { ReactNode } from 'react';
import { PLATFORM_LABELS, type ReportResult } from '@matchup/shared';
import { useI18n } from '../i18n';
import type { PhotosStatus } from '../api';

const RING = 2 * Math.PI * 42; // circunferencia del anillo de score (r=42)

/**
 * Vista presentacional del reporte (SPEC §4.4 / §4.1 regla de paridad):
 * la MISMA usada por el reporte real (/report/:slug) y por el sample (/sample),
 * para garantizar que el ejemplo y el entregable sean idénticos en especificidad.
 */
export function ReportView({
  result,
  photos = [],
  photosStatus = 'NONE',
  pdfUrl = null,
  title,
  banner,
  footer,
  locked,
  lockedInfo,
}: {
  result?: ReportResult;
  photos?: string[];
  photosStatus?: PhotosStatus;
  pdfUrl?: string | null;
  title?: string;
  banner?: ReactNode;
  footer?: ReactNode;
  /** Modo paywall (SPEC §12.1.2b): muestra la estructura del reporte con el contenido tapado. */
  locked?: boolean;
  lockedInfo?: { score: number; photoCount: number; problemCount: number };
}) {
  const t = useI18n();

  // Vista previa BLOQUEADA (SPEC §12.1.2b): solo estructura + placeholders. El
  // contenido real nunca se computa ni viaja al navegador (regla de seguridad).
  if (locked && lockedInfo) {
    return <LockedReport info={lockedInfo} title={title} banner={banner} footer={footer} t={t} />;
  }

  const r = result!;

  return (
    <div className="mk-narrow mk-page">
      {banner}

      <div className="mk-page-head">
        <h1>{title ?? 'Your audit'}</h1>
        {pdfUrl && (
          <a href={pdfUrl} className="mk-btn sm">
            {t.common.downloadPdf}
          </a>
        )}
      </div>

      <div className="mk-cards">
        {/* Overall score */}
        <section className="mk-card">
          <h2>{t.report.overallScore}</h2>
          <div className="mk-overall">
            <div className="mk-ring2">
              <svg viewBox="0 0 96 96" aria-hidden="true">
                <circle className="t" cx="48" cy="48" r="42" />
                <circle
                  className="p"
                  cx="48"
                  cy="48"
                  r="42"
                  style={{ strokeDashoffset: RING * (1 - r.overallScore / 100) }}
                />
              </svg>
              <span className="n">{r.overallScore}</span>
            </div>
            <div className="meta">
              <span className="cap">out of 100</span>
              {r.platform && <span className="mk-badge">Optimized for {PLATFORM_LABELS[r.platform]}</span>}
            </div>
          </div>
        </section>

        {/* Photo by photo */}
        <section className="mk-card">
          <h2>{t.report.photoScores}</h2>
          <div className="mk-photo-row">
            {r.photos.map((p) => (
              <div key={p.index} className="mk-photo">
                <div className="top">
                  <span className="lbl">Photo {p.index + 1}</span>
                  <span className={`mk-chip2 ${p.keep ? 'keep' : 'drop'}`}>
                    {p.keep ? t.report.keep : t.report.drop}
                  </span>
                  <span className="sc">{p.score}/100</span>
                </div>
                <div className="track">
                  <div className={`fill${p.keep ? ' g' : ''}`} style={{ width: `${p.score}%` }} />
                </div>
                {p.strengths.length > 0 && (
                  <p className="note">
                    <b>Strengths:</b> {p.strengths.join('; ')}
                  </p>
                )}
                {p.issues.length > 0 && (
                  <p className="note">
                    <b>Fix:</b> {p.issues.join('; ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Bio diagnosis — el "lápiz rojo": crítica honesta marcada en rojo */}
        <section className="mk-card">
          <h2>
            <span className="pen-ic">✎</span>
            {t.report.bioDiagnosis}
          </h2>
          <p className="mk-diag-red">{r.bioDiagnosis}</p>
        </section>

        {/* Rewritten bios — correcciones aprobadas, en verde */}
        <section className="mk-card">
          <h2>{t.report.rewrittenBios}</h2>
          <div className="mk-rewrites">
            {r.rewrittenBios.map((b, i) => (
              <p key={i} className="mk-rewrite-item">
                {b}
              </p>
            ))}
          </div>
        </section>

        {/* Suggested prompts */}
        {r.suggestedPrompts.length > 0 && (
          <section className="mk-card">
            <h2>{t.report.suggestedPrompts}</h2>
            <div className="mk-prompts">
              {r.suggestedPrompts.map((p, i) => (
                <div key={i} className="mk-prompt">
                  <p className="q">{p.prompt}</p>
                  <p className="a">{p.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Action plan */}
        <section className="mk-card">
          <h2>{t.report.actionPlan}</h2>
          <ol className="mk-plan">
            {r.actionPlan.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>

        {/* AI photos */}
        {photosStatus === 'PROCESSING' && (
          <section className="mk-card">
            <h2>{t.report.aiPhotos}</h2>
            <div className="mk-inline-status">
              <span className="mk-spin" />
              <span>{t.report.photosProcessing}</span>
            </div>
          </section>
        )}

        {photosStatus === 'FAILED' && (
          <section className="mk-card">
            <h2>{t.report.aiPhotos}</h2>
            <p style={{ color: 'var(--ink-soft)', margin: 0 }}>{t.report.photosFailed}</p>
          </section>
        )}

        {photosStatus === 'READY' && photos.length > 0 && (
          <section className="mk-card">
            <h2>{t.report.aiPhotos}</h2>
            <div className="mk-photos-grid">
              {photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`AI photo ${i + 1}`} loading="lazy" />
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      {footer}
    </div>
  );
}

/** Reporte con el contenido tapado (SPEC §12.1.2b). Solo estructura + placeholders. */
function LockedReport({
  info,
  title,
  banner,
  footer,
  t,
}: {
  info: { score: number; photoCount: number; problemCount: number };
  title?: string;
  banner?: ReactNode;
  footer?: ReactNode;
  t: ReturnType<typeof useI18n>;
}) {
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(n || lo, hi));
  const photoRows = Array.from({ length: clamp(info.photoCount, 3, 8) });
  const problemRows = Array.from({ length: clamp(info.problemCount, 2, 6) });

  return (
    <div className="mk-narrow mk-page">
      {banner}
      <div className="mk-page-head">
        <h1>{title ?? 'Your full report'}</h1>
      </div>
      <div className="mk-cards">
        <section className="mk-card">
          <h2>{t.report.overallScore}</h2>
          <div className="mk-overall">
            <div className="mk-ring2">
              <svg viewBox="0 0 96 96" aria-hidden="true">
                <circle className="t" cx="48" cy="48" r="42" />
                <circle
                  className="p"
                  cx="48"
                  cy="48"
                  r="42"
                  style={{ strokeDashoffset: RING * (1 - info.score / 100) }}
                />
              </svg>
              <span className="n">{info.score}</span>
            </div>
            <div className="meta">
              <span className="cap">out of 100</span>
            </div>
          </div>
        </section>

        <section className="mk-card">
          <h2>
            {t.report.photoScores} <span className="mk-lock">🔒</span>
          </h2>
          <div className="mk-photo-row">
            {photoRows.map((_, i) => (
              <div key={i} className="mk-photo">
                <div className="top">
                  <span className="lbl">Photo {i + 1}</span>
                  <span className="mk-lockbar" style={{ marginLeft: 'auto', width: '3.5rem' }} />
                </div>
                <span className="mk-lockbar" style={{ height: '8px', display: 'block' }} />
              </div>
            ))}
          </div>
        </section>

        <section className="mk-card">
          <h2>
            <span className="pen-ic">✎</span>What&apos;s pushing matches away <span className="mk-lock">🔒</span>
          </h2>
          <div className="mk-lockrows">
            {problemRows.map((_, i) => (
              <div key={i} className="mk-lockrow">
                <b>Problem #{i + 1}</b>
                <span className="mk-lockbar" style={{ flex: 1 }} />
              </div>
            ))}
          </div>
        </section>

        <section className="mk-card">
          <h2>
            {t.report.rewrittenBios} <span className="mk-lock">🔒</span>
          </h2>
          <div className="mk-lockblock">
            <span className="mk-lockbar" />
            <span className="mk-lockbar" style={{ width: '88%' }} />
            <span className="mk-lockbar" style={{ width: '62%' }} />
          </div>
        </section>

        <section className="mk-card">
          <h2>
            {t.report.actionPlan} <span className="mk-lock">🔒</span>
          </h2>
          <div className="mk-lockrows">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="mk-lockrow">
                <b>{i + 1}</b>
                <span className="mk-lockbar" style={{ flex: 1 }} />
              </div>
            ))}
          </div>
        </section>
      </div>
      {footer}
    </div>
  );
}
