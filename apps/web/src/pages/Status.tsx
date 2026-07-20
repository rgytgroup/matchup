import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';
import { getStatus } from '../api';

/** Estado del procesamiento por polling (SPEC §4.5): analizando → listo → email enviado. */
export function Status() {
  const { orderId } = useParams();
  const t = useI18n();
  const [status, setStatus] = useState<string>('PENDING');
  const [reportSlug, setReportSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let active = true;

    async function poll() {
      try {
        const res = await getStatus(orderId as string);
        if (!active) return;
        setStatus(res.status);
        setReportSlug(res.reportSlug);
        if (res.status === 'DONE' || res.status === 'FAILED') return;
      } catch {
        /* reintenta en el próximo tick */
      }
      if (active) setTimeout(poll, 3000);
    }

    poll();
    return () => {
      active = false;
    };
  }, [orderId]);

  return (
    <Layout>
      <div className="mk-form mk-center-note">
        {status === 'DONE' && reportSlug ? (
          <>
            <span className="big">{t.status.ready}</span>
            <p className="mk-hint">{t.status.emailSent}</p>
            <Link to={`/report/${reportSlug}`} className="mk-btn">
              View report
            </Link>
          </>
        ) : status === 'FAILED' ? (
          <>
            <span className="big">{t.common.errorGeneric}</span>
            <p className="mk-hint">Order: {orderId}</p>
          </>
        ) : (
          <>
            <span className="mk-spin" style={{ width: '2.4rem', height: '2.4rem', borderWidth: '3px' }} />
            <span className="big">{t.status.analyzing}</span>
            <p className="mk-hint">Order: {orderId}</p>
          </>
        )}
      </div>
    </Layout>
  );
}
