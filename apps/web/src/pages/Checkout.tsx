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
        <div className="mk-form mk-center-note">
          <p style={{ color: 'var(--ink-soft)' }}>No hay una orden en curso.</p>
          <Link to="/start" className="mk-btn">
            {t.landing.heroCta}
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mk-form mk-center-note" style={{ maxWidth: '30rem' }}>
        <h1 className="font-display" style={{ fontWeight: 800, fontSize: '2rem', margin: 0 }}>
          Checkout
        </h1>
        <p style={{ color: 'var(--ink-soft)', margin: 0 }}>You&apos;re one step away from your report.</p>
        <button onClick={goToStripe} disabled={loading} className="mk-btn" style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? t.common.loading : 'Pay with Stripe'}
        </button>
        {error && <p className="mk-error">{error}</p>}
        <p className="mk-hint" style={{ fontSize: '.8rem' }}>{t.landing.noSubscriptions}</p>
      </div>
    </Layout>
  );
}
