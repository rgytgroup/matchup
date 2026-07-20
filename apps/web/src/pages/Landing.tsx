import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TIERS } from '@matchup/shared';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';
import { track } from '../api';

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Is this a subscription?',
    a: 'No. MatchUp is a one-time purchase. No recurring charges, ever.',
  },
  {
    q: 'What do I get?',
    a: 'A report with an overall score, a score for each photo, a bio diagnosis, three rewritten bios, suggested prompts, and a 5-step action plan.',
  },
  {
    q: 'What about the AI photos?',
    a: 'The premium tier generates 30 photos of you in better settings. We change context, clothing and lighting — never your actual features.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Yes. If you are not satisfied, request a refund within 7 days.',
  },
];

export function Landing() {
  const t = useI18n();

  useEffect(() => {
    track('landing.visit');
  }, []);

  return (
    <Layout>
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t.landing.heroTitle}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{t.landing.heroSubtitle}</p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            to="/start"
            className="rounded-full bg-slate-900 px-8 py-3 text-base font-semibold text-white"
          >
            {t.landing.heroCta}
          </Link>
          <span className="text-sm text-slate-500">{t.landing.noSubscriptions}</span>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold">{t.pricing.title}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <PricingCard
              name={t.pricing.audit}
              price={TIERS.AUDIT.priceUsd}
              tier="AUDIT"
              cta={t.pricing.cta}
            />
            <PricingCard
              name={t.pricing.auditPlus}
              price={TIERS.AUDIT_PLUS_PHOTOS.priceUsd}
              tier="AUDIT_PLUS_PHOTOS"
              perk={t.pricing.photosPerk}
              cta={t.pricing.cta}
              highlighted
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold">{t.landing.faqTitle}</h2>
        <dl className="mt-8 space-y-6">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-1 text-slate-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </Layout>
  );
}

function PricingCard(props: {
  name: string;
  price: number;
  tier: string;
  perk?: string;
  cta: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-white p-6 ${
        props.highlighted ? 'border-slate-900 shadow-sm' : 'border-slate-200'
      }`}
    >
      <h3 className="text-lg font-semibold">{props.name}</h3>
      <p className="mt-2 text-3xl font-bold">${props.price.toFixed(2)}</p>
      {props.perk && <p className="mt-3 text-sm text-slate-600">{props.perk}</p>}
      <Link
        to={`/start?tier=${props.tier}`}
        className="mt-6 rounded-full bg-slate-900 px-6 py-2 text-center font-medium text-white"
      >
        {props.cta}
      </Link>
    </div>
  );
}
