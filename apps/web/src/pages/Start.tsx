import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isTierId, TIERS, UPLOAD_RULES, type TierId } from '@matchup/shared';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';
import { createSubmission } from '../api';

/** Intake (SPEC §4.2): cuestionario + upload 3–8 fotos + bio → crea la orden y va a checkout. */
export function Start() {
  const t = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTier = params.get('tier');

  const [tier, setTier] = useState<TierId>(
    initialTier && isTierId(initialTier) ? initialTier : 'AUDIT',
  );
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [q, setQ] = useState({ goal: '', apps: '', ageRange: '', city: '' });
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return setError('Ingresa tu email.');
    if (photos.length < UPLOAD_RULES.minPhotos) {
      return setError(`Sube al menos ${UPLOAD_RULES.minPhotos} fotos.`);
    }

    const form = new FormData();
    form.append('email', email);
    form.append('tier', tier);
    form.append('bioText', bio);
    form.append('questionnaire', JSON.stringify(q));
    photos.forEach((p) => form.append('photos', p));

    setSubmitting(true);
    setError(null);
    try {
      const { orderId } = await createSubmission(form);
      navigate(`/checkout?orderId=${orderId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-8 px-4 py-12">
        <h1 className="text-3xl font-bold">{t.start.title}</h1>

        <div className="space-y-2">
          <span className="text-lg font-semibold">Plan</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(TIERS) as TierId[]).map((id) => (
              <button
                type="button"
                key={id}
                onClick={() => setTier(id)}
                className={`rounded-xl border p-4 text-left ${
                  tier === id ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'
                }`}
              >
                <span className="block font-medium">
                  {id === 'AUDIT_PLUS_PHOTOS' ? t.pricing.auditPlus : t.pricing.audit}
                </span>
                <span className="text-sm text-slate-500">${TIERS[id].priceUsd.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2"
          />
        </div>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">{t.start.questionnaire}</legend>
          <TextField label="What's your main goal?" value={q.goal} onChange={(v) => setQ({ ...q, goal: v })} />
          <TextField label="Which apps do you use?" value={q.apps} onChange={(v) => setQ({ ...q, apps: v })} />
          <TextField label="Your age range" value={q.ageRange} onChange={(v) => setQ({ ...q, ageRange: v })} />
          <TextField label="City" value={q.city} onChange={(v) => setQ({ ...q, city: v })} />
        </fieldset>

        <div className="space-y-2">
          <label className="text-lg font-semibold">{t.start.uploadPhotos}</label>
          <input
            type="file"
            multiple
            accept={UPLOAD_RULES.acceptedMimeTypes.join(',')}
            onChange={(e) => onFiles(e.target.files)}
            className="block w-full text-sm"
          />
          <p className="text-sm text-slate-500">{t.start.uploadHint}</p>
          {photos.length > 0 && (
            <p className="text-sm text-slate-600">{photos.length} foto(s) seleccionada(s)</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="bio" className="text-lg font-semibold">
            {t.start.bioLabel}
          </label>
          <textarea
            id="bio"
            rows={5}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-slate-900 px-8 py-3 font-semibold text-white disabled:opacity-60"
        >
          {submitting ? t.common.loading : t.start.submit}
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
