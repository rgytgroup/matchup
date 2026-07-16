import { useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';

/**
 * Reporte web accesible por slug sin login (SPEC §4.4).
 * TODO(report): fetch a GET /report/:slug, validar con reportResultSchema y
 * renderizar score global, score por foto, diagnóstico, bios, prompts y plan.
 */
export function Report() {
  const { slug } = useParams();
  const t = useI18n();

  const sections = [
    t.report.overallScore,
    t.report.photoScores,
    t.report.bioDiagnosis,
    t.report.rewrittenBios,
    t.report.suggestedPrompts,
    t.report.actionPlan,
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">{t.common.appName} report</h1>
        <p className="mt-2 text-sm text-slate-500">slug: {slug}</p>

        <div className="mt-8 space-y-4">
          {sections.map((title) => (
            <section key={title} className="rounded-2xl border border-slate-200 p-6">
              <h2 className="font-semibold">{title}</h2>
              <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            </section>
          ))}
        </div>

        <button className="mt-8 rounded-full bg-slate-900 px-6 py-2 font-medium text-white">
          {t.common.downloadPdf}
        </button>
      </div>
    </Layout>
  );
}
