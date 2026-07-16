import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isTierId, TIERS } from '@matchup/shared';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';

/** Redirige a Stripe Checkout con el tier elegido (SPEC §4.3). */
export function Checkout() {
  const t = useI18n();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const tierParam = params.get('tier') ?? 'AUDIT';
  const tier = isTierId(tierParam) ? TIERS[tierParam] : TIERS.AUDIT;

  async function goToStripe() {
    setLoading(true);
    // TODO(checkout): POST /checkout {email, tier} y redirigir a session.url.
    setLoading(false);
    alert('Integración de Stripe Checkout pendiente (SPEC §4.3).');
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <div className="mt-6 rounded-2xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">{tier.id}</p>
          <p className="mt-2 text-3xl font-bold">${tier.priceUsd.toFixed(2)}</p>
          {tier.includesPhotos && (
            <p className="mt-2 text-sm text-slate-600">{t.pricing.photosPerk}</p>
          )}
        </div>
        <button
          onClick={goToStripe}
          disabled={loading}
          className="mt-6 w-full rounded-full bg-slate-900 px-8 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? t.common.loading : 'Pay with Stripe'}
        </button>
        <p className="mt-4 text-xs text-slate-500">{t.landing.noSubscriptions}</p>
      </div>
    </Layout>
  );
}
