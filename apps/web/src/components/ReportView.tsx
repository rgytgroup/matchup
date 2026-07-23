import { useState, type ReactNode } from 'react';
import { PLATFORM_LABELS, type ReportResult } from '@matchup/shared';
import { useI18n } from '../i18n';
import type { PhotosStatus } from '../api';

const RING = 2 * Math.PI * 42; // circunferencia del anillo de score (r=42)

export interface AiPhotoMeta {
  url: string;
  scenario: string;
  score?: number;
  attributes?: string[];
}

/**
 * Reporte v2 — Dashboard de diagnóstico (SPEC §14). MISMO componente para el
 * reporte real (/report/:slug) y el sample (/sample) → paridad garantizada.
 * En modo `locked` (puerta falsa §12.1.2b) muestra solo la estructura tapada.
 */
export function ReportView({
  result,
  photos = [],
  aiPhotoMeta,
  photosStatus = 'NONE',
  pdfUrl = null,
  subject,
  title,
  banner,
  footer,
  locked,
  lockedInfo,
}: {
  result?: ReportResult;
  photos?: string[];
  aiPhotoMeta?: AiPhotoMeta[];
  photosStatus?: PhotosStatus;
  pdfUrl?: string | null;
  subject?: { name: string; avatarUrl?: string; completedAt?: string };
  title?: string;
  banner?: ReactNode;
  footer?: ReactNode;
  locked?: boolean;
  lockedInfo?: { score: number; photoCount: number; problemCount: number };
}) {
  const t = useI18n();

  if (locked && lockedInfo) {
    return <LockedReport info={lockedInfo} title={title} banner={banner} footer={footer} t={t} />;
  }

  const r = result!;
  const totalSuggestions = r.categoryScores
    ? r.categoryScores.photos.suggestions + r.categoryScores.bio.suggestions + r.categoryScores.prompts.suggestions
    : undefined;

  const SECTIONS = [
    { id: 'overview', label: 'Overview' },
    { id: 'photos', label: 'Photo feedback' },
    { id: 'bio', label: 'Bio analysis' },
    { id: 'bios', label: 'Rewritten bios' },
    { id: 'prompts', label: 'Prompt suggestions' },
    { id: 'plan', label: 'Action plan' },
    ...(photosStatus === 'READY' || (aiPhotoMeta && aiPhotoMeta.length) ? [{ id: 'aiphotos', label: 'AI photos' }] : []),
  ];

  return (
    <div className="mk-r2">
      {banner}

      <div className="mk-r2-grid">
      {/* Sidebar sticky (desktop) */}
      <aside className="mk-r2-side">
        {subject && (
          <div className="who">
            {subject.avatarUrl && <img src={subject.avatarUrl} alt="" className="av" />}
            <div>
              <div className="nm">{subject.name}</div>
              {r.platform && <div className="pf">Optimized for {PLATFORM_LABELS[r.platform]}</div>}
            </div>
          </div>
        )}
        <div className="scorepill">
          <span className="s">{r.overallScore}</span>
          <span className="sep">→</span>
          {r.potentialScore != null && <span className="p">{r.potentialScore}</span>}
        </div>
        <nav>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>{s.label}</a>
          ))}
        </nav>
        {pdfUrl && (
          <a href={pdfUrl} className="mk-btn ghost sm">{t.common.downloadPdf}</a>
        )}
        {subject?.completedAt && <p className="ts">{subject.completedAt}</p>}
      </aside>

      <main className="mk-r2-main">
        {/* ---- Hero dashboard ---- */}
        <section className="mk-r2-hero" id="top">
          <div className="ident">
            {subject?.avatarUrl && <img src={subject.avatarUrl} alt="" className="av" />}
            <div>
              <h1>{subject ? subject.name : title ?? 'Your audit'}</h1>
              {r.platform && <span className="mk-badge">Optimized for {PLATFORM_LABELS[r.platform]}</span>}
              {subject?.completedAt && <span className="ts">{subject.completedAt}</span>}
            </div>
          </div>
          <div className="scores">
            <ScoreRing label="Your score" value={r.overallScore} tone="honey" />
            {r.potentialScore != null && (
              <div className="pot">
                <span className="lbl">Your potential ✦</span>
                <span className="val">{r.potentialScore}<small>/100</small></span>
                <p>Great profiles get more right swipes and better conversations.</p>
                <PotentialCurve />
              </div>
            )}
          </div>
        </section>

        {/* ---- Overview widgets ---- */}
        {r.categoryScores && (
          <section className="mk-r2-kpis" id="overview">
            <Kpi label="Total suggestions" value={totalSuggestions ?? 0} sub="across photos, bio & prompts" accent />
            <Kpi label="Photos score" value={r.categoryScores.photos.score} sub={`${r.categoryScores.photos.suggestions} suggestions`} />
            <Kpi label="Bio score" value={r.categoryScores.bio.score} sub={`${r.categoryScores.bio.suggestions} suggestions`} />
            <Kpi label="Prompts score" value={r.categoryScores.prompts.score} sub={`${r.categoryScores.prompts.suggestions} suggestions`} />
          </section>
        )}

        {/* ---- Photo feedback (tarjetas comparables) ---- */}
        <section id="photos">
          <SecHead title="Photo-by-photo feedback" sub={`${r.photos.length} photos analyzed`} />
          <div className="mk-r2-photos">
            {r.photos.map((p) => (
              <div key={p.index} className="mk-r2-photo">
                <div className="hd">
                  <span className="sc">{p.score}<small>/100</small></span>
                  <span className={`mk-chip2 ${p.keep ? 'keep' : 'drop'}`}>{p.keep ? 'KEEP' : 'CONSIDER DROPPING'}</span>
                </div>
                <span className="lbl">Photo {p.index + 1}</span>
                {p.strengths.length > 0 && (
                  <div className="tags good">{p.strengths.slice(0, 2).map((s, i) => <span key={i}>{s}</span>)}</div>
                )}
                {p.issues.length > 0 && (
                  <div className="tags bad">{p.issues.slice(0, 2).map((s, i) => <span key={i}>{s}</span>)}</div>
                )}
                {p.recommendation && <p className="rec">→ {p.recommendation}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ---- Bio analysis (escaneable) ---- */}
        <section id="bio">
          <SecHead title="Bio analysis" />
          <div className="mk-card mk-r2-bio">
            {r.bioAnalysis?.marks?.length ? (
              <ul className="marks">
                {r.bioAnalysis.marks.map((m, i) => <li key={i}>❌ {m}</li>)}
              </ul>
            ) : null}
            <p className="diag">{r.bioDiagnosis}</p>
            {r.bioAnalysis?.impact && <p className="meta"><b>Impact:</b> {r.bioAnalysis.impact}</p>}
            {r.bioAnalysis?.direction && <p className="meta"><b>Fix:</b> {r.bioAnalysis.direction}</p>}
          </div>
        </section>

        {/* ---- Rewritten bios (tarjetas con copiar) ---- */}
        <section id="bios">
          <SecHead title="Rewritten bios" sub="Pick the voice that fits you" />
          <div className="mk-r2-bios">
            {r.rewrittenBios.map((b, i) => <BioCard key={i} bio={b} />)}
          </div>
        </section>

        {/* ---- Prompt suggestions (estructurados) ---- */}
        {r.suggestedPrompts.length > 0 && (
          <section id="prompts">
            <SecHead title="Prompt suggestions" />
            <div className="mk-r2-prompts">
              {r.suggestedPrompts.map((p, i) => (
                <div key={i} className="mk-card mk-r2-prompt">
                  <p className="q">{p.prompt}</p>
                  <p className="a">{p.answer}</p>
                  {p.why && <p className="why"><b>Why it works:</b> {p.why}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- Action plan (tabla con tiempo/impacto) ---- */}
        <section id="plan">
          <SecHead title="Your action plan" sub="Do these in order to reach your potential" />
          <div className="mk-r2-plan">
            {r.actionPlan.map((task, i) => (
              <div key={i} className="row">
                <span className="no">{i + 1}</span>
                <span className="tk">{task.task}</span>
                {task.minutes != null && <span className="tm">{task.minutes} min</span>}
                {task.impact && <span className={`imp ${task.impact.toLowerCase()}`}>{task.impact}</span>}
              </div>
            ))}
          </div>
        </section>

        {/* ---- AI photos ---- */}
        {aiPhotoMeta && aiPhotoMeta.length > 0 ? (
          <section id="aiphotos">
            <SecHead title="AI photos" sub="Your face, in your best light" />
            <div className="mk-r2-aiphotos">
              {aiPhotoMeta.map((ph, i) => (
                <a key={i} href={ph.url} target="_blank" rel="noreferrer" className="ai">
                  <img src={ph.url} alt={ph.scenario} loading="lazy" />
                  <div className="ov">
                    <div className="top">
                      <span className="scn">{ph.scenario}</span>
                      {ph.score != null && <span className="sc">{ph.score}</span>}
                    </div>
                    {ph.attributes && <div className="attrs">{ph.attributes.map((a, j) => <span key={j}>{a}</span>)}</div>}
                  </div>
                </a>
              ))}
            </div>
          </section>
        ) : (
          <AiPhotosBlock t={t} photosStatus={photosStatus} photos={photos} />
        )}

        {footer}
      </main>
      </div>
    </div>
  );
}

/* ---------- subcomponentes ---------- */

function ScoreRing({ label, value, tone }: { label: string; value: number; tone: 'honey' | 'win' }) {
  return (
    <div className="mk-r2-ring">
      <span className="lbl">{label}</span>
      <div className="ring" data-tone={tone}>
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <circle className="t" cx="48" cy="48" r="42" />
          <circle className="p" cx="48" cy="48" r="42" style={{ strokeDashoffset: RING * (1 - value / 100) }} />
        </svg>
        <span className="n">{value}<small>/100</small></span>
      </div>
    </div>
  );
}

function PotentialCurve() {
  // Flecha/arco current→potencial (SPEC §13.3): NO una curva tipo bolsa de valores.
  return (
    <svg className="mk-r2-curve" viewBox="0 0 120 34" aria-hidden="true">
      <defs>
        <marker id="ah-r" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--win)" />
        </marker>
      </defs>
      <path d="M6,28 Q74,28 106,9" fill="none" stroke="var(--win)" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#ah-r)" />
    </svg>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: number; sub: string; accent?: boolean }) {
  return (
    <div className={`mk-r2-kpi${accent ? ' accent' : ''}`}>
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
      <span className="sub">{sub}</span>
    </div>
  );
}

function SecHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mk-r2-sechead">
      <h2>{title}</h2>
      {sub && <span>{sub}</span>}
    </div>
  );
}

function BioCard({ bio }: { bio: { style: string; text: string; best?: boolean } }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(bio.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <div className={`mk-card mk-r2-biocard${bio.best ? ' best' : ''}`}>
      <div className="hd">
        <span className="style">{bio.style}</span>
        {bio.best && <span className="badge">Best</span>}
      </div>
      <p className="tx">{bio.text}</p>
      <button type="button" className="mk-btn ghost sm" onClick={copy}>
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}

function AiPhotosBlock({ t, photosStatus, photos }: { t: ReturnType<typeof useI18n>; photosStatus: PhotosStatus; photos: string[] }) {
  if (photosStatus === 'PROCESSING') {
    return (
      <section className="mk-card" style={{ margin: '1.3rem 0' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', margin: '0 0 1rem' }}>{t.report.aiPhotos}</h2>
        <div className="mk-inline-status"><span className="mk-spin" /><span>{t.report.photosProcessing}</span></div>
      </section>
    );
  }
  if (photosStatus === 'FAILED') {
    return (
      <section className="mk-card" style={{ margin: '1.3rem 0' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', margin: '0 0 1rem' }}>{t.report.aiPhotos}</h2>
        <p style={{ color: 'var(--ink-soft)', margin: 0 }}>{t.report.photosFailed}</p>
      </section>
    );
  }
  if (photosStatus === 'READY' && photos.length > 0) {
    return (
      <section id="aiphotos">
        <SecHead title={t.report.aiPhotos} />
        <div className="mk-photos-grid">
          {photos.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`AI photo ${i + 1}`} loading="lazy" /></a>
          ))}
        </div>
      </section>
    );
  }
  return null;
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
  const rows = (n: number) => Array.from({ length: Math.max(1, Math.min(n || 1, 12)) });
  const photoRows = rows(info.photoCount);
  const problemRows = rows(info.problemCount);

  return (
    <div className="mk-narrow mk-page">
      {banner}
      <div className="mk-page-head"><h1>{title ?? 'Your full report'}</h1></div>
      <div className="mk-cards">
        <section className="mk-card">
          <h2>{t.report.overallScore}</h2>
          <div className="mk-overall">
            <div className="mk-ring2">
              <svg viewBox="0 0 96 96" aria-hidden="true">
                <circle className="t" cx="48" cy="48" r="42" />
                <circle className="p" cx="48" cy="48" r="42" style={{ strokeDashoffset: RING * (1 - info.score / 100) }} />
              </svg>
              <span className="n">{info.score}</span>
            </div>
            <div className="meta"><span className="cap">out of 100</span></div>
          </div>
        </section>
        <section className="mk-card">
          <h2>{t.report.photoScores} <span className="mk-lock">🔒</span></h2>
          <div className="mk-photo-row">
            {photoRows.map((_, i) => (
              <div key={i} className="mk-photo">
                <div className="top"><span className="lbl">Photo {i + 1}</span><span className="mk-lockbar" style={{ marginLeft: 'auto', width: '3.5rem' }} /></div>
                <span className="mk-lockbar" style={{ height: '8px', display: 'block' }} />
              </div>
            ))}
          </div>
        </section>
        <section className="mk-card">
          <h2><span className="pen-ic">✎</span>What&apos;s pushing matches away <span className="mk-lock">🔒</span></h2>
          <div className="mk-lockrows">
            {problemRows.map((_, i) => (
              <div key={i} className="mk-lockrow"><b>Problem #{i + 1}</b><span className="mk-lockbar" style={{ flex: 1 }} /></div>
            ))}
          </div>
        </section>
        <section className="mk-card">
          <h2>{t.report.rewrittenBios} <span className="mk-lock">🔒</span></h2>
          <div className="mk-lockblock"><span className="mk-lockbar" /><span className="mk-lockbar" style={{ width: '88%' }} /><span className="mk-lockbar" style={{ width: '62%' }} /></div>
        </section>
        <section className="mk-card">
          <h2>{t.report.actionPlan} <span className="mk-lock">🔒</span></h2>
          <div className="mk-lockrows">
            {rows(5).map((_, i) => (<div key={i} className="mk-lockrow"><b>{i + 1}</b><span className="mk-lockbar" style={{ flex: 1 }} /></div>))}
          </div>
        </section>
      </div>
      {footer}
    </div>
  );
}
