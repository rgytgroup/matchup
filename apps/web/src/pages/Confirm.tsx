import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  PLATFORMS,
  PLATFORM_LABELS,
  UPLOAD_RULES,
  isPlatform,
  type Platform,
} from '@matchup/shared';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';
import { confirmExtraction, getStatus, type ExtractedProfile } from '../api';

type Phase = 'loading' | 'confirming' | 'failed';
interface Prompt {
  prompt: string;
  answer: string;
}

/**
 * Pantalla de confirmación (SPEC §5.0, enfoque híbrido C): el usuario revisa/corrige
 * lo que Gemini extrajo de sus screenshots y sube sus FOTOS ORIGINALES.
 */
export function Confirm() {
  const t = useI18n();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [failReason, setFailReason] = useState<string | null>(null);

  const [platform, setPlatform] = useState<Platform>('other');
  const [bioText, setBioText] = useState('');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [q, setQ] = useState({ goal: '', ageRange: '', city: '' });
  const [photos, setPhotos] = useState<File[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const hydrated = useRef(false);

  // Polling del estado de extracción hasta CONFIRMING (o FAILED).
  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const s = await getStatus(orderId!);
        if (!alive) return;

        if (s.status === 'FAILED') {
          const reason = (s.extractedProfile as ExtractedProfile | null)?.reason ?? 'extraction_error';
          setFailReason(reason);
          setPhase('failed');
          return;
        }

        // CONFIRMING (o cualquier estado posterior): hidratar el formulario una vez.
        if (s.extractedProfile && !hydrated.current) {
          hydrated.current = true;
          const ex = s.extractedProfile as ExtractedProfile;
          if (ex.platform && isPlatform(ex.platform)) setPlatform(ex.platform);
          else if (s.platform && isPlatform(s.platform)) setPlatform(s.platform);
          setBioText(ex.bioText ?? '');
          setPrompts(ex.prompts?.length ? ex.prompts : []);
        }

        if (s.status === 'EXTRACTING') {
          timer = setTimeout(poll, 2500);
          return;
        }
        setPhase('confirming');
      } catch {
        // Reintenta suave: puede ser que la orden aún no exista.
        timer = setTimeout(poll, 3000);
      }
    }

    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [orderId]);

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list);
    const tooBig = files.find((f) => f.size > UPLOAD_RULES.maxBytesPerPhoto);
    if (tooBig) {
      setError(`"${tooBig.name}" supera el tamaño máximo permitido.`);
      return;
    }
    // Guardián anti-screenshot (SPEC §6.0): estas son las fotos ORIGINALES para el análisis
    // y el LoRA — un screenshot arruina la calidad. Chequeo instantáneo en el cliente.
    for (const f of files) {
      if (await looksLikeScreenshot(f)) {
        setError(
          `"${f.name}" looks like a screenshot. Upload the original photo from your gallery — not a screenshot — for the best results.`,
        );
        return;
      }
    }
    setError(null);
    setPhotos(files.slice(0, UPLOAD_RULES.maxPhotos));
  }

  function setPrompt(i: number, patch: Partial<Prompt>) {
    setPrompts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) return;
    if (photos.length < UPLOAD_RULES.minPhotos) {
      return setError(`Sube al menos ${UPLOAD_RULES.minPhotos} fotos originales.`);
    }

    const cleanPrompts = prompts.filter((p) => p.prompt.trim() || p.answer.trim());
    const form = new FormData();
    form.append('platform', platform);
    form.append('bioText', bioText);
    form.append('prompts', JSON.stringify(cleanPrompts));
    form.append('questionnaire', JSON.stringify(q));
    photos.forEach((p) => form.append('photos', p));

    setSubmitting(true);
    setError(null);
    try {
      await confirmExtraction(orderId, form);
      navigate(`/checkout?orderId=${orderId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  if (phase === 'loading') {
    return (
      <Layout>
        <div className="mk-form mk-center-note">
          <span className="mk-spin" style={{ width: '2.4rem', height: '2.4rem', borderWidth: '3px' }} />
          <span className="big">{t.confirm.reading}</span>
          <p className="mk-hint">{t.confirm.readingHint}</p>
        </div>
      </Layout>
    );
  }

  if (phase === 'failed') {
    return (
      <Layout>
        <div className="mk-form mk-center-note">
          <p style={{ color: 'var(--ink-soft)', maxWidth: '44ch' }}>
            {failReason === 'third_party' ? t.confirm.failedThirdParty : t.confirm.failedGeneric}
          </p>
          <Link to="/start" className="mk-btn">
            {t.confirm.startOver}
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <form onSubmit={onSubmit} className="mk-form">
        <div className="mk-form-head">
          <h1>{t.confirm.title}</h1>
          <p>{t.confirm.subtitle}</p>
        </div>

        <div className="mk-group">
          <span className="glabel">{t.confirm.platformLabel}</span>
          <div className="mk-optgrid four">
            {PLATFORMS.map((pf) => (
              <button
                type="button"
                key={pf}
                onClick={() => setPlatform(pf)}
                className={`mk-opt center${platform === pf ? ' sel' : ''}`}
              >
                {PLATFORM_LABELS[pf]}
              </button>
            ))}
          </div>
        </div>

        <div className="mk-group">
          <label htmlFor="bio" className="glabel">
            {t.confirm.bioLabel}
          </label>
          <textarea
            id="bio"
            rows={5}
            value={bioText}
            onChange={(e) => setBioText(e.target.value)}
            className="mk-textarea"
          />
        </div>

        <div className="mk-group">
          <span className="glabel">{t.confirm.promptsLabel}</span>
          {prompts.map((p, i) => (
            <div key={i} className="mk-prompt-edit">
              <input
                type="text"
                value={p.prompt}
                placeholder={t.confirm.promptPlaceholder}
                onChange={(e) => setPrompt(i, { prompt: e.target.value })}
                className="mk-input"
                style={{ fontWeight: 600 }}
              />
              <input
                type="text"
                value={p.answer}
                placeholder={t.confirm.answerPlaceholder}
                onChange={(e) => setPrompt(i, { answer: e.target.value })}
                className="mk-input"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPrompts((prev) => [...prev, { prompt: '', answer: '' }])}
            className="mk-link"
            style={{ alignSelf: 'flex-start' }}
          >
            + {t.confirm.addPrompt}
          </button>
        </div>

        <div className="mk-group">
          <span className="glabel">{t.start.questionnaire}</span>
          <TextField label="What's your main goal?" value={q.goal} onChange={(v) => setQ({ ...q, goal: v })} />
          <TextField label="Your age range" value={q.ageRange} onChange={(v) => setQ({ ...q, ageRange: v })} />
          <TextField label="City" value={q.city} onChange={(v) => setQ({ ...q, city: v })} />
        </div>

        <div className="mk-group">
          <span className="glabel">{t.confirm.uploadPhotosLabel}</span>
          <div className="mk-dropzone">
            <input
              type="file"
              multiple
              accept={UPLOAD_RULES.acceptedMimeTypes.join(',')}
              onChange={(e) => onFiles(e.target.files)}
              className="mk-file"
            />
            <p className="mk-hint">{t.confirm.uploadPhotosHint}</p>
            {photos.length > 0 && (
              <p className="mk-count">
                {photos.length} {t.confirm.photosSelected}
              </p>
            )}
          </div>
        </div>

        {error && <p className="mk-error">{error}</p>}

        <button type="submit" disabled={submitting} className="mk-btn" style={{ alignSelf: 'flex-start' }}>
          {submitting ? t.common.loading : t.confirm.submit}
        </button>
      </form>
    </Layout>
  );
}

/** ¿La imagen tiene proporción de captura de pantalla de teléfono? (SPEC §6.0) */
function looksLikeScreenshot(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.max(img.width, img.height) / Math.min(img.width, img.height);
      resolve(ratio >= 1.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mk-group" style={{ gap: '.4rem' }}>
      <label className="mk-label">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mk-input"
      />
    </div>
  );
}
