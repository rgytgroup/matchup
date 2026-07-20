import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PLATFORM_LABELS, type ReportResult } from '@matchup/shared';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';
import { getReport, type PhotosStatus } from '../api';

const RING = 2 * Math.PI * 42; // circunferencia del anillo de score (r=42)

/** Reporte web accesible por slug sin login (SPEC §4.4). */
export function Report() {
  const { slug } = useParams();
  const t = useI18n();
  const [data, setData] = useState<{
    result: ReportResult;
    pdfUrl: string | null;
    photos: string[];
    photosStatus: PhotosStatus;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getReport(slug)
      .then((r) =>
        setData({ result: r.result, pdfUrl: r.pdfUrl, photos: r.photos, photosStatus: r.photosStatus }),
      )
      .catch((e) => setError((e as Error).message));
  }, [slug]);

  if (error) {
    return (
      <Layout>
        <div className="mk-narrow mk-page">
          <p style={{ color: 'var(--coral)' }}>{error}</p>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="mk-narrow mk-page mk-inline-status">
          <span className="mk-spin" />
          {t.common.loading}
        </div>
      </Layout>
    );
  }

  const r = data.result;

  return (
    <Layout>
      <div className="mk-narrow mk-page">
        <div className="mk-page-head">
          <h1>Your audit</h1>
          {data.pdfUrl && (
            <a href={data.pdfUrl} className="mk-btn sm">
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
                    <div
                      className={`fill${p.keep ? ' g' : ''}`}
                      style={{ width: `${p.score}%` }}
                    />
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

          {/* Rewritten bios — las correcciones aprobadas, en verde */}
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
          {data.photosStatus === 'PROCESSING' && (
            <section className="mk-card">
              <h2>{t.report.aiPhotos}</h2>
              <div className="mk-inline-status">
                <span className="mk-spin" />
                <span>{t.report.photosProcessing}</span>
              </div>
            </section>
          )}

          {data.photosStatus === 'FAILED' && (
            <section className="mk-card">
              <h2>{t.report.aiPhotos}</h2>
              <p style={{ color: 'var(--ink-soft)', margin: 0 }}>{t.report.photosFailed}</p>
            </section>
          )}

          {data.photosStatus === 'READY' && data.photos.length > 0 && (
            <section className="mk-card">
              <h2>{t.report.aiPhotos}</h2>
              <div className="mk-photos-grid">
                {data.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" download>
                    <img src={url} alt={`AI photo ${i + 1}`} loading="lazy" />
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}
