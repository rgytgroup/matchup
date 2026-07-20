/**
 * Strings de UI en inglés (v1). Toda cadena visible al usuario vive aquí
 * desde el día 1 (CLAUDE.md / SPEC §2). ES/PT se agregarán como hermanos.
 */
export const en = {
  common: {
    appName: 'MatchUp',
    tagline: 'Honest AI audits for your dating profile.',
    downloadPdf: 'Download PDF',
    loading: 'Loading…',
    errorGeneric: 'Something went wrong. Please try again.',
  },
  nav: {
    howItWorks: 'How it works',
    pricing: 'Pricing',
    faq: 'FAQ',
    startCta: 'Audit my profile',
  },
  landing: {
    heroTitle: 'Find out what your dating profile really says.',
    heroSubtitle:
      'Just screenshot your profile. Get an honest, AI-powered report with scores, a diagnosis, rewritten bios, and a step-by-step action plan.',
    heroCta: 'Start my audit',
    noSubscriptions: 'One-time purchase. No subscriptions, ever.',
    faqTitle: 'Frequently asked questions',
  },
  pricing: {
    title: 'Simple, one-time pricing',
    audit: 'Profile Audit',
    auditDesc:
      'We analyze the photos and bio you use today and give you scores, a diagnosis, 3 rewritten bios, prompt ideas, and a 5-step action plan.',
    auditPlus: 'Audit + AI Photos',
    auditPlusDesc:
      'Everything in the Audit — plus 30 brand-new AI photos of you, generated from the pictures you upload.',
    photosPerk: '+ 30 AI-generated photos of you',
    cta: 'Choose',
  },
  start: {
    title: 'Screenshot your profile — we read the rest',
    subtitle:
      'Open your dating app, screenshot your own profile (the way others see it), and upload the shots. We pull out your bio, prompts and platform automatically.',
    questionnaire: 'A few quick questions',
    uploadScreenshots: 'Upload screenshots of your profile (1–10)',
    screenshotHint:
      'Screenshots of YOUR OWN profile — the preview/edit view. We extract your text; you’ll upload your original photos on the next step. PNG, JPG or WEBP.',
    screenshotsSelected: 'screenshot(s) selected',
    uploadPhotos: 'Upload your current profile photos (3–8)',
    uploadHint:
      'These are the photos you use on your dating apps today — we analyze each one. JPG, PNG or WEBP · up to 10 MB each.',
    photosNote:
      'Both plans analyze the photos you upload. The premium plan also generates 30 new AI photos of you from them.',
    bioLabel: 'Paste your current bio and prompts',
    submit: 'Read my profile',
  },
  confirm: {
    title: 'Confirm your profile',
    subtitle: 'We read this from your screenshots. Fix anything that looks off, then add your photos.',
    reading: 'Reading your screenshots…',
    readingHint: 'This usually takes 10–20 seconds.',
    platformLabel: 'Which app is this profile on?',
    bioLabel: 'Your bio',
    promptsLabel: 'Your prompts',
    promptPlaceholder: 'Prompt',
    answerPlaceholder: 'Answer',
    addPrompt: 'Add prompt',
    uploadPhotosLabel: 'Now upload your original photos (3–8)',
    uploadPhotosHint:
      'The real, full-resolution photos from your profile — not the screenshots. We analyze each one (and the premium plan generates new AI photos from them). JPG, PNG or WEBP · up to 10 MB each.',
    photosSelected: 'photo(s) selected',
    submit: 'Continue to checkout',
    failedThirdParty:
      'These screenshots look like someone else’s profile. We only audit your OWN profile — please upload screenshots of your profile’s preview/edit view.',
    failedGeneric:
      'We couldn’t read those screenshots. Try clearer, full-screen shots of your own profile.',
    startOver: 'Start over',
  },
  report: {
    overallScore: 'Overall score',
    photoScores: 'Photo-by-photo',
    keep: 'Keep',
    drop: 'Consider dropping',
    bioDiagnosis: 'Bio diagnosis',
    rewrittenBios: 'Rewritten bios',
    suggestedPrompts: 'Suggested prompts',
    actionPlan: 'Your 5-step action plan',
    aiPhotos: 'Your AI photos',
    photosProcessing:
      "We're generating your AI photos — this takes about 20–30 minutes. We'll email you when they're ready.",
    photosFailed:
      'We hit a snag generating your photos. Our team has been notified and will get it sorted.',
  },
  status: {
    analyzing: 'Analyzing your profile…',
    ready: 'Your report is ready',
    emailSent: "We've emailed you the link.",
  },
} as const;

export type Messages = typeof en;
