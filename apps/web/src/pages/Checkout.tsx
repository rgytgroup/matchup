import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';
import { createCheckout, track } from '../api';

/** Redirige a Stripe Checkout para la orden creada en el intake (SPEC §4.3). */
export function Checkout() {
  const t = useI18n();
  const [params] = useSearchParams();
  const orderId = params.get('orderId');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track('checkout.viewed');
  }, []);

  async function goToStripe() {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const { url } = await createCheckout(orderId);
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  if (!orderId) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-slate-600">No hay una orden en curso.</p>
          <Link to="/start" className="mt-4 inline-block font-medium underline">
            {t.landing.heroCta}
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <p className="mt-4 text-slate-600">You're one step away from your report.</p>
        <button
          onClick={goToStripe}
          disabled={loading}
          className="mt-6 w-full rounded-full bg-slate-900 px-8 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? t.common.loading : 'Pay with Stripe'}
        </button>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <p className="mt-4 text-xs text-slate-500">{t.landing.noSubscriptions}</p>
      </div>
    </Layout>
  );
}
