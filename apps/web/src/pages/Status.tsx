import { useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';

/**
 * Estado del procesamiento por polling (SPEC §4.5): analizando → listo → email enviado.
 * TODO(status): poll a GET /status/:orderId y avanzar los estados reales.
 */
export function Status() {
  const { orderId } = useParams();
  const t = useI18n();

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        <h1 className="mt-6 text-xl font-semibold">{t.status.analyzing}</h1>
        <p className="mt-2 text-sm text-slate-500">Order: {orderId}</p>
      </div>
    </Layout>
  );
}
