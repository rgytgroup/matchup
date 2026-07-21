import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ReportResult } from '@matchup/shared';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';
import { ReportView } from '../components/ReportView';
import { getReport, type PhotosStatus } from '../api';

/** Reporte web accesible por slug sin login (SPEC §4.4). */
export function Report() {
  const { slug } = useParams();
  const t = useI18n();
  const [data, setData] = useState<{
    result: ReportResult;
    pdfUrl: string | null;
    photos: string[];
    photosStatus: PhotosStatus;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getReport(slug)
      .then((r) =>
        setData({ result: r.result, pdfUrl: r.pdfUrl, photos: r.photos, photosStatus: r.photosStatus }),
      )
      .catch((e) => setError((e as Error).message));
  }, [slug]);

  if (error) {
    return (
      <Layout>
        <div className="mk-narrow mk-page">
          <p style={{ color: 'var(--coral)' }}>{error}</p>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="mk-narrow mk-page mk-inline-status">
          <span className="mk-spin" />
          {t.common.loading}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <ReportView
        result={data.result}
        photos={data.photos}
        photosStatus={data.photosStatus}
        pdfUrl={data.pdfUrl}
      />
    </Layout>
  );
}
