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
    heroEyebrow: 'Honest audit · no subscriptions',
    heroTitle: 'Your best profile,',
    heroTitleEmph: 'on purpose.',
    heroSubtitle:
      "Screenshot your dating profile and get a coach's honest read — scores, a plan, rewritten bios, and new photos of you that actually land.",
    heroCta: 'Audit my profile',
    sampleCta: 'See a sample report',
    microTrust: 'One-time purchase · 7-day refund · photos deleted after 30 days.',
    noSubscriptions: 'One-time purchase. No subscriptions, ever.',
    reportEyebrow: 'What you get',
    reportTitle: 'A real plan — not a vague pep talk.',
    reportIntro:
      "We grade what's working, name what's holding you back, and hand you the exact fix. Here's a sample.",
    photosEyebrow: 'Premium · Audit + AI Photos',
    photosTitle: 'Your face. Better rooms, better light.',
    photosIntro:
      'Upload the photos you have; we generate 30 new ones of you in settings that actually flatter — golden hour, a bright café, a clean studio portrait.',
    photosGuardLabel: 'Where we draw the line:',
    photosGuardText: 'we change context, clothing and lighting — never your actual features.',
    stepsEyebrow: 'How it works',
    stepsTitle: 'Three steps. About ten minutes.',
    step1Title: 'Screenshot your profile',
    step1Body:
      'Open Tinder, Hinge or Bumble, screenshot your own profile, and upload the shots. We read the rest.',
    step2Title: 'We read & grade it',
    step2Body:
      'We pull out your bio, prompts and photos. You confirm what we read, then add your original photos.',
    step3Title: 'Get your report',
    step3Body:
      'Scores, diagnosis, rewritten bios and a plan — plus 30 new AI photos on the premium plan.',
    trustEyebrow: 'Why trust us',
    trustTitle: 'Honest beats flattering.',
    trustIntro: 'Honesty is the whole product — so the guarantees are too.',
    trustNote:
      "The whole point is the read you can't get from friends who don't want to hurt your feelings.",
    trustNoteLead: "We won't tell you your profile is great when it isn't. ",
    finalTitle: 'See what your profile really says.',
    finalSub: 'Ten minutes. One honest report. Better matches.',
    faqTitle: 'Straight answers.',
  },
  promises: {
    noSubsTitle: 'No subscriptions',
    noSubsBody: 'One payment. We never store a card to charge you again.',
    refundTitle: '7-day refund',
    refundBody: 'Not useful? Ask within 7 days and we refund you.',
    deleteTitle: 'Photos deleted',
    deleteBody: 'Everything you upload is deleted after 30 days.',
    neverTitle: 'Never altered',
    neverBody: 'AI photos change the setting, never your face or body.',
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'One payment. Pick your depth.',
    intro: 'No subscriptions, no upsells, no fake countdown timers. Ever.',
    oneTime: 'one-time',
    ribbon: 'Most chosen',
    audit: 'Profile Audit',
    auditDesc:
      'We analyze the photos and bio you use today and give you scores, a diagnosis, 3 rewritten bios, prompt ideas, and a 5-step action plan.',
    auditPlus: 'Audit + AI Photos',
    auditPlusDesc:
      'Everything in the Audit — plus 30 brand-new AI photos of you, generated from the pictures you upload.',
    photosPerk: '+ 30 AI-generated photos of you',
    cta: 'Choose',
    ctaAudit: 'Choose Audit',
    ctaPlus: 'Choose Audit + Photos',
    auditPerk1: 'Overall score + a score for every photo',
    auditPerk2: 'Honest bio diagnosis',
    auditPerk3: '3 rewritten bios & prompt ideas',
    auditPerk4: 'Your 5-step action plan',
    plusPerk1: 'Everything in the Audit',
    plusPerk2: '30 brand-new AI photos of you',
    plusPerk3: 'Flattering settings & lighting',
    plusPerk4: 'Your real features, always kept',
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
