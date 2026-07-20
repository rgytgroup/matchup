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

  function onFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list);
    const tooBig = files.find((f) => f.size > UPLOAD_RULES.maxBytesPerPhoto);
    if (tooBig) {
      setError(`"${tooBig.name}" supera el tamaño máximo permitido.`);
      return;
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
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          <p className="text-lg font-semibold">{t.confirm.reading}</p>
          <p className="mt-2 text-sm text-slate-500">{t.confirm.readingHint}</p>
        </div>
      </Layout>
    );
  }

  if (phase === 'failed') {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <p className="text-slate-700">
            {failReason === 'third_party' ? t.confirm.failedThirdParty : t.confirm.failedGeneric}
          </p>
          <Link
            to="/start"
            className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-2.5 font-semibold text-white"
          >
            {t.confirm.startOver}
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-8 px-4 py-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t.confirm.title}</h1>
          <p className="text-slate-600">{t.confirm.subtitle}</p>
        </div>

        <div className="space-y-2">
          <span className="text-lg font-semibold">{t.confirm.platformLabel}</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PLATFORMS.map((pf) => (
              <button
                type="button"
                key={pf}
                onClick={() => setPlatform(pf)}
                className={`rounded-xl border p-3 text-center font-medium ${
                  platform === pf ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'
                }`}
              >
                {PLATFORM_LABELS[pf]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="bio" className="text-lg font-semibold">
            {t.confirm.bioLabel}
          </label>
          <textarea
            id="bio"
            rows={5}
            value={bioText}
            onChange={(e) => setBioText(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3"
          />
        </div>

        <div className="space-y-3">
          <span className="text-lg font-semibold">{t.confirm.promptsLabel}</span>
          {prompts.map((p, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <input
                type="text"
                value={p.prompt}
                placeholder={t.confirm.promptPlaceholder}
                onChange={(e) => setPrompt(i, { prompt: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm font-medium"
              />
              <input
                type="text"
                value={p.answer}
                placeholder={t.confirm.answerPlaceholder}
                onChange={(e) => setPrompt(i, { answer: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPrompts((prev) => [...prev, { prompt: '', answer: '' }])}
            className="text-sm font-medium text-slate-700 underline"
          >
            + {t.confirm.addPrompt}
          </button>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">{t.start.questionnaire}</legend>
          <TextField label="What's your main goal?" value={q.goal} onChange={(v) => setQ({ ...q, goal: v })} />
          <TextField label="Your age range" value={q.ageRange} onChange={(v) => setQ({ ...q, ageRange: v })} />
          <TextField label="City" value={q.city} onChange={(v) => setQ({ ...q, city: v })} />
        </fieldset>

        <div className="space-y-2 rounded-xl border-2 border-dashed border-slate-300 p-4">
          <label className="text-lg font-semibold">{t.confirm.uploadPhotosLabel}</label>
          <input
            type="file"
            multiple
            accept={UPLOAD_RULES.acceptedMimeTypes.join(',')}
            onChange={(e) => onFiles(e.target.files)}
            className="block w-full text-sm"
          />
          <p className="text-sm text-slate-500">{t.confirm.uploadPhotosHint}</p>
          {photos.length > 0 && (
            <p className="text-sm text-slate-600">
              {photos.length} {t.confirm.photosSelected}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-slate-900 px-8 py-3 font-semibold text-white disabled:opacity-60"
        >
          {submitting ? t.common.loading : t.confirm.submit}
        </button>
      </form>
    </Layout>
  );
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
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 p-2"
      />
    </div>
  );
}
