import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isTierId, TIERS, type TierId } from '@matchup/shared';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';
import { startExtraction } from '../api';

const MAX_SCREENSHOTS = 10;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Intake screenshot-first (SPEC §5.0): el usuario sube screenshots de su perfil;
 * Gemini extrae el texto y en la pantalla de confirmación sube sus fotos originales.
 */
export function Start() {
  const t = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTier = params.get('tier');

  const [tier, setTier] = useState<TierId>(
    initialTier && isTierId(initialTier) ? initialTier : 'AUDIT',
  );
  const [email, setEmail] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list);
    const bad = files.find((f) => !ACCEPTED.includes(f.type));
    if (bad) {
      setError(`"${bad.name}" no es una imagen válida (usa PNG, JPG o WEBP).`);
      return;
    }
    setError(null);
    setScreenshots(files.slice(0, MAX_SCREENSHOTS));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return setError('Ingresa tu email.');
    if (screenshots.length < 1) return setError('Sube al menos un screenshot de tu perfil.');

    const form = new FormData();
    form.append('email', email);
    form.append('tier', tier);
    screenshots.forEach((s) => form.append('screenshots', s));

    setSubmitting(true);
    setError(null);
    try {
      const { orderId } = await startExtraction(form);
      navigate(`/confirm/${orderId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-8 px-4 py-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{t.start.title}</h1>
          <p className="text-slate-600">{t.start.subtitle}</p>
        </div>

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
          <p className="text-sm text-slate-500">{t.start.photosNote}</p>
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

        <div className="space-y-2">
          <label className="text-lg font-semibold">{t.start.uploadScreenshots}</label>
          <input
            type="file"
            multiple
            accept={ACCEPTED.join(',')}
            onChange={(e) => onFiles(e.target.files)}
            className="block w-full text-sm"
          />
          <p className="text-sm text-slate-500">{t.start.screenshotHint}</p>
          {screenshots.length > 0 && (
            <p className="text-sm text-slate-600">
              {screenshots.length} {t.start.screenshotsSelected}
            </p>
          )}
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
