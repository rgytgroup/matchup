import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UPLOAD_RULES } from '@matchup/shared';
import { useI18n } from '../i18n';
import { Layout } from '../components/Layout';

/**
 * Intake (SPEC §4.2): cuestionario (6 preguntas) → upload 3–8 fotos → bio.
 * Scaffold funcional; el upload real a Supabase storage y el POST se cablean después.
 */
export function Start() {
  const t = useI18n();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function onFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list);
    const tooBig = files.find((f) => f.size > UPLOAD_RULES.maxBytesPerPhoto);
    if (tooBig) {
      setError(`"${tooBig.name}" supera el tamaño máximo permitido.`);
      return;
    }
    setError(null);
    setPhotos(files.slice(0, UPLOAD_RULES.maxPhotos));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (photos.length < UPLOAD_RULES.minPhotos) {
      setError(`Sube al menos ${UPLOAD_RULES.minPhotos} fotos.`);
      return;
    }
    // TODO(intake): subir fotos a Supabase (URLs firmadas) y crear la Submission vía API.
    navigate('/checkout?tier=AUDIT');
  }

  return (
    <Layout>
      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-8 px-4 py-12">
        <h1 className="text-3xl font-bold">{t.start.title}</h1>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">{t.start.questionnaire}</legend>
          <TextField label="What's your main goal?" name="goal" />
          <TextField label="Which apps do you use?" name="apps" />
          <TextField label="Your age range" name="ageRange" />
          <TextField label="City" name="city" />
        </fieldset>

        <div className="space-y-2">
          <label className="text-lg font-semibold">{t.start.uploadPhotos}</label>
          <input
            type="file"
            multiple
            accept={UPLOAD_RULES.acceptedMimeTypes.join(',')}
            onChange={(e) => onFiles(e.target.files)}
            className="block w-full text-sm"
          />
          <p className="text-sm text-slate-500">{t.start.uploadHint}</p>
          {photos.length > 0 && (
            <p className="text-sm text-slate-600">{photos.length} foto(s) seleccionada(s)</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="bio" className="text-lg font-semibold">
            {t.start.bioLabel}
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={5}
            className="w-full rounded-lg border border-slate-300 p-3"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="rounded-full bg-slate-900 px-8 py-3 font-semibold text-white"
        >
          {t.start.submit}
        </button>
      </form>
    </Layout>
  );
}

function TextField({ label, name }: { label: string; name: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        className="w-full rounded-lg border border-slate-300 p-2"
      />
    </div>
  );
}
