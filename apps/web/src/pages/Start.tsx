import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isTierId, TIERS, type TierId } from '@matchup/shared';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';
import { getConfig, startExtraction } from '../api';
import { FakeDoor } from './FakeDoor';

const MAX_SCREENSHOTS = 10;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Decide el flujo de intake: puerta falsa (§12, mientras no haya pagos) o el
 * intake real screenshot-first (§5.0). El modo lo define el backend vía /config.
 */
export function Start() {
  const [cfg, setCfg] = useState<{ fakeDoor: boolean; priceAb: boolean } | null>(null);

  useEffect(() => {
    getConfig().then(setCfg).catch(() => setCfg({ fakeDoor: false, priceAb: false }));
  }, []);

  if (!cfg) {
    return (
      <Layout>
        <div className="mk-form mk-center-note">
          <span className="mk-spin" style={{ width: '2rem', height: '2rem', borderWidth: '3px' }} />
        </div>
      </Layout>
    );
  }
  if (cfg.fakeDoor) return <FakeDoor priceAb={cfg.priceAb} />;
  return <RealStart />;
}

/**
 * Intake screenshot-first (SPEC §5.0): el usuario sube screenshots de su perfil;
 * Gemini extrae el texto y en la pantalla de confirmación sube sus fotos originales.
 */
function RealStart() {
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
      <form onSubmit={onSubmit} className="mk-form">
        <div className="mk-form-head">
          <h1>{t.start.title}</h1>
          <p>{t.start.subtitle}</p>
        </div>

        <div className="mk-group">
          <span className="glabel">Plan</span>
          <div className="mk-optgrid">
            {(Object.keys(TIERS) as TierId[]).map((id) => (
              <button
                type="button"
                key={id}
                onClick={() => setTier(id)}
                className={`mk-opt${tier === id ? ' sel' : ''}`}
              >
                <span className="name">
                  {id === 'AUDIT_PLUS_PHOTOS' ? t.pricing.auditPlus : t.pricing.audit}
                </span>
                <span className="price">${TIERS[id].priceUsd.toFixed(2)}</span>
              </button>
            ))}
          </div>
          <p className="mk-hint">{t.start.photosNote}</p>
        </div>

        <div className="mk-group">
          <label htmlFor="email" className="mk-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mk-input"
          />
        </div>

        <div className="mk-group">
          <span className="glabel">{t.start.uploadScreenshots}</span>
          <div className="mk-dropzone">
            <input
              type="file"
              multiple
              accept={ACCEPTED.join(',')}
              onChange={(e) => onFiles(e.target.files)}
              className="mk-file"
            />
            <p className="mk-hint">{t.start.screenshotHint}</p>
            {screenshots.length > 0 && (
              <p className="mk-count">
                {screenshots.length} {t.start.screenshotsSelected}
              </p>
            )}
          </div>
        </div>

        {error && <p className="mk-error">{error}</p>}

        <button type="submit" disabled={submitting} className="mk-btn" style={{ alignSelf: 'flex-start' }}>
          {submitting ? t.common.loading : t.start.submit}
        </button>
      </form>
    </Layout>
  );
}
