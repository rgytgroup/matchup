import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';
import { getStatus, retryOrder } from '../api';

type StatusResp = Awaited<ReturnType<typeof getStatus>>;

const FAILED = ['FAILED', 'NEEDS_ATTENTION'];

/** Estado del procesamiento por polling (SPEC §4.5 / §11.4): honesto, con Retry cuando aplica. */
export function Status() {
  const { orderId } = useParams();
  const t = useI18n();
  const [s, setS] = useState<StatusResp | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retried, setRetried] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!orderId) return;
    let alive = true;

    async function poll() {
      try {
        const res = await getStatus(orderId!);
        if (!alive) return;
        setS(res);
        if (isFinal(res)) return; // deja de hacer polling en estados terminales
      } catch {
        /* reintenta en el próximo tick */
      }
      if (alive) timer.current = setTimeout(poll, 3000);
    }

    void poll();
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, [orderId]);

  async function onRetry() {
    if (!orderId) return;
    setRetrying(true);
    try {
      await retryOrder(orderId);
      setRetried(true);
      // Reanuda el polling para reflejar el nuevo progreso.
      const res = await getStatus(orderId);
      setS(res);
      timer.current = setTimeout(function tick() {
        void getStatus(orderId).then((r) => {
          setS(r);
          if (!isFinal(r)) timer.current = setTimeout(tick, 3000);
        });
      }, 3000);
    } catch {
      /* noop */
    } finally {
      setRetrying(false);
    }
  }

  if (!s) {
    return (
      <Layout>
        <div className="mk-form mk-center-note">
          <span className="mk-spin" style={{ width: '2.4rem', height: '2.4rem', borderWidth: '3px' }} />
          <span className="big">{t.status.analyzing}</span>
        </div>
      </Layout>
    );
  }

  const analysisFailed = FAILED.includes(s.status);
  const done = s.status === 'DONE';
  const premium = s.tier === 'AUDIT_PLUS_PHOTOS';
  const photosFailed = premium && FAILED.includes(s.photosJobStatus ?? '');
  const photosDone = s.photosJobStatus === 'DONE';
  const photosInProgress = premium && done && !photosDone && !photosFailed;

  return (
    <Layout>
      <div className="mk-form mk-center-note">
        {/* Análisis falló → mensaje honesto + Retry */}
        {analysisFailed && (
          <>
            <span className="big">{t.status.needsAttentionTitle}</span>
            <p className="mk-hint" style={{ maxWidth: '44ch' }}>{t.status.needsAttentionBody}</p>
            <RetryOrMessage retried={retried} retrying={retrying} onRetry={onRetry} t={t} />
          </>
        )}

        {/* En progreso (análisis) */}
        {!analysisFailed && !done && (
          <>
            <span className="mk-spin" style={{ width: '2.4rem', height: '2.4rem', borderWidth: '3px' }} />
            <span className="big">{t.status.analyzing}</span>
            <p className="mk-hint">{t.status.analyzingHint}</p>
          </>
        )}

        {/* Reporte listo */}
        {done && (
          <>
            <span className="big">{t.status.ready}</span>
            <p className="mk-hint">{t.status.emailSent}</p>
            {s.reportSlug && (
              <Link to={`/report/${s.reportSlug}`} className="mk-btn">
                {t.status.viewReport}
              </Link>
            )}

            {/* Premium: estado de las fotos IA */}
            {photosInProgress && (
              <div className="mk-status-sub">
                <span className="mk-spin" />
                <div>
                  <p className="ttl">{t.status.photosGeneratingTitle}</p>
                  <p className="mk-hint">{t.status.photosGeneratingBody}</p>
                </div>
              </div>
            )}
            {photosFailed && (
              <div className="mk-status-sub">
                <div>
                  <p className="ttl">{t.status.photosSnagTitle}</p>
                  <p className="mk-hint">{t.status.photosSnagBody}</p>
                  <div style={{ marginTop: '.7rem' }}>
                    <RetryOrMessage retried={retried} retrying={retrying} onRetry={onRetry} t={t} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function RetryOrMessage({
  retried,
  retrying,
  onRetry,
  t,
}: {
  retried: boolean;
  retrying: boolean;
  onRetry: () => void;
  t: ReturnType<typeof useI18n>;
}) {
  if (retried) return <p className="mk-hint" style={{ color: 'var(--win)', fontWeight: 600 }}>{t.status.retryQueued}</p>;
  return (
    <button type="button" className="mk-btn" onClick={onRetry} disabled={retrying}>
      {retrying ? t.status.retrying : t.status.retry}
    </button>
  );
}

/** Estados terminales para el polling (no seguir consultando). */
function isFinal(s: StatusResp): boolean {
  if (FAILED.includes(s.status)) return true; // análisis falló
  if (s.status !== 'DONE') return false; // aún procesando
  if (s.tier !== 'AUDIT_PLUS_PHOTOS') return true; // audit: listo
  return s.photosJobStatus === 'DONE' || FAILED.includes(s.photosJobStatus ?? ''); // premium: fotos resueltas
}
