import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ReportResult } from '@matchup/shared';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';
import { getReport } from '../api';

/** Reporte web accesible por slug sin login (SPEC §4.4). */
export function Report() {
  const { slug } = useParams();
  const t = useI18n();
  const [data, setData] = useState<{
    result: ReportResult;
    pdfUrl: string | null;
    photos: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getReport(slug)
      .then((r) => setData({ result: r.result, pdfUrl: r.pdfUrl, photos: r.photos }))
      .catch((e) => setError((e as Error).message));
  }, [slug]);

  if (error) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-12">
          <p className="text-red-600">{error}</p>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-12 text-slate-500">{t.common.loading}</div>
      </Layout>
    );
  }

  const r = data.result;

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Your audit</h1>
          {data.pdfUrl && (
            <a
              href={data.pdfUrl}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white"
            >
              {t.common.downloadPdf}
            </a>
          )}
        </div>

        <Card title={t.report.overallScore}>
          <p className="text-4xl font-bold">{r.overallScore}/100</p>
        </Card>

        <Card title={t.report.photoScores}>
          <ul className="space-y-3">
            {r.photos.map((p) => (
              <li key={p.index} className="border-b border-slate-100 pb-3 last:border-0">
                <p className="font-medium">
                  Photo {p.index + 1}: {p.score}/100 —{' '}
                  <span className={p.keep ? 'text-green-600' : 'text-amber-600'}>
                    {p.keep ? t.report.keep : t.report.drop}
                  </span>
                </p>
                {p.issues.length > 0 && (
                  <p className="mt-1 text-sm text-slate-600">Issues: {p.issues.join('; ')}</p>
                )}
                {p.strengths.length > 0 && (
                  <p className="text-sm text-slate-600">Strengths: {p.strengths.join('; ')}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t.report.bioDiagnosis}>
          <p className="text-slate-700">{r.bioDiagnosis}</p>
        </Card>

        <Card title={t.report.rewrittenBios}>
          <ol className="list-decimal space-y-2 pl-5 text-slate-700">
            {r.rewrittenBios.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ol>
        </Card>

        {r.suggestedPrompts.length > 0 && (
          <Card title={t.report.suggestedPrompts}>
            <ul className="space-y-3">
              {r.suggestedPrompts.map((p, i) => (
                <li key={i}>
                  <p className="font-medium">{p.prompt}</p>
                  <p className="text-sm text-slate-600">{p.answer}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title={t.report.actionPlan}>
          <ol className="list-decimal space-y-2 pl-5 text-slate-700">
            {r.actionPlan.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Card>

        {data.photos.length > 0 && (
          <Card title={t.report.aiPhotos}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" download>
                  <img
                    src={url}
                    alt={`AI photo ${i + 1}`}
                    className="aspect-square w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-6">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
