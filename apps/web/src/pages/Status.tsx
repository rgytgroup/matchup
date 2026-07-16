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
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        {status === 'DONE' && reportSlug ? (
          <>
            <h1 className="text-xl font-semibold">{t.status.ready}</h1>
            <p className="mt-2 text-sm text-slate-500">{t.status.emailSent}</p>
            <Link
              to={`/report/${reportSlug}`}
              className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-2 font-medium text-white"
            >
              View report
            </Link>
          </>
        ) : status === 'FAILED' ? (
          <>
            <h1 className="text-xl font-semibold">{t.common.errorGeneric}</h1>
            <p className="mt-2 text-sm text-slate-500">Order: {orderId}</p>
          </>
        ) : (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
            <h1 className="mt-6 text-xl font-semibold">{t.status.analyzing}</h1>
            <p className="mt-2 text-sm text-slate-500">Order: {orderId}</p>
          </>
        )}
      </div>
    </Layout>
  );
}
