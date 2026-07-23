import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TIERS, type ReportResult } from '@matchup/shared';
import { Layout } from '../components/Layout';
import { ReportView, type AiPhotoMeta } from '../components/ReportView';
import { track } from '../api';

/** Fotos IA de ejemplo (Mateo) — mismo protagonista que la landing (SPEC §4.1). */
const MATEO_AI_PHOTOS: AiPhotoMeta[] = [
  { url: '/persona/golden.jpg', scenario: 'Golden hour', score: 93, attributes: ['Warm light', 'Relaxed', 'Casual'] },
  { url: '/persona/cafe.jpg', scenario: 'Warm café', score: 90, attributes: ['Soft light', 'Genuine smile', 'Knit'] },
  { url: '/persona/studio.jpg', scenario: 'Studio', score: 89, attributes: ['Crisp light', 'Confident', 'Smart casual'] },
  { url: '/persona/city.jpg', scenario: 'City evening', score: 88, attributes: ['Bokeh', 'Candid', 'Denim'] },
  { url: '/persona/hero.jpg', scenario: 'Window portrait', score: 91, attributes: ['Daylight', 'Eye contact', 'Henley'] },
];

/** Reporte de ejemplo COMPLETO (SPEC §4.1, §14.15) — mismo componente que el real. */
const SAMPLE_RESULT: ReportResult = {
  platform: 'tinder',
  overallScore: 61,
  potentialScore: 88,
  categoryScores: {
    photos: { score: 66, suggestions: 3 },
    bio: { score: 52, suggestions: 1 },
    prompts: { score: 70, suggestions: 1 },
  },
  photos: [
    { index: 0, score: 82, keep: true, strengths: ['Sharp, warm smile', 'Great eye contact'], issues: [], recommendation: 'Lead with this one — it’s your opener.' },
    { index: 1, score: 44, keep: false, strengths: [], issues: ['Same angle as Photo 1', 'Dim lighting'], recommendation: 'Cut it — it duplicates Photo 1.' },
    { index: 2, score: 38, keep: false, strengths: [], issues: ['Group shot', 'Low resolution'], recommendation: 'Replace with a full-body daylight shot.' },
    { index: 3, score: 55, keep: true, strengths: ['Shows a hobby'], issues: ['Sunglasses hide your eyes'], recommendation: 'Swap for a version without sunglasses.' },
    { index: 4, score: 70, keep: true, strengths: ['Full-body, good posture'], issues: ['Busy background'], recommendation: 'Keep — maybe crop the background.' },
  ],
  missingArchetypes: ['A candid photo doing something you love', 'A clear full-body shot'],
  bioDiagnosis:
    "Your bio lists traits instead of showing them, so it reads like everyone else's and gives a match nothing to reply to.",
  bioAnalysis: {
    marks: ['Reads generic', 'Lists traits instead of stories', 'Gives nothing to reply to'],
    why: 'Trait lists ("I like travel and good food") describe you but invite no response.',
    impact: 'Fewer opening messages — matches skim and swipe on.',
    direction: 'Trade the trait list for one specific, true story with a hook.',
  },
  rewrittenBios: [
    { style: 'Conversation Starter', text: 'I build bridges for a living and lose every argument to my rescue dog. Ask me about the worst empanada I’ve had in 12 countries.', best: true },
    { style: 'Funny', text: 'Engineer by day, amateur empanada critic by weekend. I’ll out-plan you on a trip and lose to my dog at tug-of-war.' },
    { style: 'Adventure', text: 'I make bridges that don’t fall down and playlists that maybe should. Tell me the last place that surprised you.' },
  ],
  suggestedPrompts: [
    { prompt: 'The way to win me over is', answer: 'a bad pun and a great taco recommendation.', why: 'Low-effort, funny, easy to reply to.' },
    { prompt: 'My most controversial opinion', answer: 'pineapple belongs on the empanada, not just the pizza.', why: 'Playful bait that invites a hot take.' },
  ],
  actionPlan: [
    { task: 'Replace Photo 3 (group shot) with a full-body photo in daylight.', minutes: 10, impact: 'High' },
    { task: 'Cut Photo 2 — it duplicates Photo 1’s angle.', minutes: 2, impact: 'Medium' },
    { task: 'Swap the trait-list bio for rewrite #1.', minutes: 5, impact: 'High' },
    { task: 'Add the empanada prompt — it invites an easy reply.', minutes: 3, impact: 'Medium' },
    { task: 'Lead with the photo scored 82. It’s your strongest opener.', minutes: 1, impact: 'High' },
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
        aiPhotoMeta={MATEO_AI_PHOTOS}
        photosStatus="READY"
        subject={{ name: 'Mateo, 34', avatarUrl: '/persona/hero.jpg', completedAt: 'Sample report' }}
        banner={
          <div className="mk-sample-banner">
            <span className="mk-eyebrow" style={{ margin: 0 }}>Sample report</span>
            <p>
              A complete, real example — a fictional profile (Mateo). Your report will look exactly
              like this, built from your own photos and bio.
            </p>
          </div>
        }
        footer={
          <div className="mk-sample-cta">
            <p>Ready to see yours?</p>
            <Link className="mk-btn" to="/start">Audit my profile — ${audit}</Link>
          </div>
        }
      />
    </Layout>
  );
}
