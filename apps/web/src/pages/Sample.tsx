import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TIERS, type ReportResult } from '@matchup/shared';
import { Layout } from '../components/Layout';
import { ReportView } from '../components/ReportView';
import { track } from '../api';

/** Fotos de la persona de ejemplo (Mateo) — el mismo protagonista de la landing. */
const MATEO_PHOTOS = [
  '/persona/hero.jpg',
  '/persona/golden.jpg',
  '/persona/cafe.jpg',
  '/persona/studio.jpg',
  '/persona/city.jpg',
];

/**
 * Reporte de ejemplo COMPLETO y navegable (SPEC §4.1 reglas 1, 3, 4).
 * Mismo protagonista (Mateo) que el héroe y las fotos premium de la landing.
 * Renderiza con ReportView — idéntico al reporte real que recibe el cliente.
 */
const SAMPLE_RESULT: ReportResult = {
  platform: 'tinder',
  overallScore: 61,
  potentialScore: 88,
  categoryScores: {
    photos: { score: 66, suggestions: 3 },
    bio: { score: 52, suggestions: 1 },
    prompts: { score: 70, suggestions: 1 },
  },
  missingArchetypes: ['A candid photo doing something you love', 'A clear full-body shot'],
  photos: [
    {
      index: 0,
      score: 82,
      keep: true,
      strengths: ['Sharp, warm, genuine smile', 'Great natural light and clear eye contact'],
      issues: [],
    },
    {
      index: 1,
      score: 44,
      keep: false,
      strengths: [],
      issues: ['Same angle as Photo 1', 'Dim indoor lighting flattens your face'],
    },
    {
      index: 2,
      score: 38,
      keep: false,
      strengths: [],
      issues: ["Group shot — a match can't tell which one is you", 'Low resolution'],
    },
    {
      index: 3,
      score: 55,
      keep: true,
      strengths: ['Shows a hobby, adds a story'],
      issues: ['Sunglasses hide your eyes — swap for a version without them'],
    },
    {
      index: 4,
      score: 70,
      keep: true,
      strengths: ['Full-body, relaxed posture'],
      issues: ['Busy background pulls focus'],
    },
  ],
  bioDiagnosis:
    "Your first photo is doing all the work — sharp, warm, real eye contact. Photos 2 and 3 repeat the same angle in dim light and add nothing new. Your bio lists traits instead of showing them, so it reads like everyone else's and gives a match nothing to reply to.",
  rewrittenBios: [
    "I build bridges for a living and lose every argument to my rescue dog. Ask me about the worst empanada I've had in 12 countries.",
    "Engineer by day, amateur empanada critic by weekend. I'll out-plan you on a trip and lose to my dog at tug-of-war.",
    "I make bridges that don't fall down and playlists that maybe should. Tell me the last thing that made you laugh out loud.",
  ],
  suggestedPrompts: [
    { prompt: 'The way to win me over is', answer: 'a bad pun and a great taco recommendation.' },
    {
      prompt: 'My most controversial opinion',
      answer: 'pineapple belongs on the empanada, not just the pizza.',
    },
  ],
  actionPlan: [
    'Replace Photo 3 (the group shot) with a full-body photo in daylight.',
    "Cut Photo 2 — it duplicates Photo 1's angle.",
    'Swap the trait-list bio for rewrite #1 above.',
    'Add the empanada prompt — it invites an easy reply.',
    "Lead with the photo scored 82. It's your strongest opener.",
  ],
};

export function Sample() {
  const audit = TIERS.AUDIT.priceUsd.toFixed(2);

  useEffect(() => {
    track('sample.viewed');
  }, []);

  return (
    <Layout>
      <ReportView
        result={SAMPLE_RESULT}
        photos={MATEO_PHOTOS}
        photosStatus="READY"
        pdfUrl={null}
        title="Sample report — Mateo, 34"
        banner={
          <div className="mk-sample-banner">
            <span className="mk-eyebrow" style={{ margin: 0 }}>
              Sample report
            </span>
            <p>
              This is a complete, real example — a fictional profile (Mateo). Your report will look
              exactly like this, built from your own photos and bio.
            </p>
          </div>
        }
        footer={
          <div className="mk-sample-cta">
            <p>Ready to see yours?</p>
            <Link className="mk-btn" to="/start">
              Audit my profile — ${audit}
            </Link>
          </div>
        }
      />
    </Layout>
  );
}
