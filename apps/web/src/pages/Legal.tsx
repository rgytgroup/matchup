import type { ReactNode } from 'react';
import { Layout } from '../components/Layout';

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="prose mt-6 space-y-4 text-slate-600">{children}</div>
      </div>
    </Layout>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        MatchUp is a one-time purchase service that provides an AI-generated audit of your dating
        profile. By using it you agree to provide only photos you own or are authorized to use.
      </p>
      <p>TODO(legal): revisar con asesoría legal antes de producción.</p>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        We store your uploaded photos only to produce your report. Uploaded photos are deleted
        automatically after 30 days. Reports are retained so you can access them by link.
      </p>
      <p>TODO(legal): detallar tratamiento de datos, sub-encargados (Supabase, Stripe, Gemini, Replicate, Resend).</p>
    </LegalPage>
  );
}

export function Refunds() {
  return (
    <LegalPage title="Refund Policy">
      <p>
        If you are not satisfied, you can request a refund within 7 days of purchase. We will mark
        your order as refunded and stop any active processing.
      </p>
    </LegalPage>
  );
}
