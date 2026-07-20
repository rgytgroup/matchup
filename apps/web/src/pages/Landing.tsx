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
    q: 'What exactly do I get?',
    a: 'An overall score, a score for each photo, a bio diagnosis, three rewritten bios, suggested prompts, and a 5-step action plan. The premium tier adds 30 new AI photos of you.',
  },
  {
    q: 'How do the AI photos work?',
    a: 'You upload photos you already have; we generate 30 of you in better settings. We change context, clothing and lighting — never your actual features.',
  },
  {
    q: 'Can I get a refund?',
    a: "Yes. If you're not satisfied, request a refund within 7 days.",
  },
  {
    q: 'What happens to my photos?',
    a: "They're used only to build your report, and everything is deleted after 30 days.",
  },
];

export function Landing() {
  const t = useI18n();
  const audit = TIERS.AUDIT.priceUsd.toFixed(2);
  const plus = TIERS.AUDIT_PLUS_PHOTOS.priceUsd.toFixed(2);

  useEffect(() => {
    track('landing.visit');
  }, []);

  return (
    <Layout>
      {/* HERO */}
      <div className="mk-hero-band">
        <section className="mk-wrap mk-hero">
          <div>
            <p className="mk-eyebrow">{t.landing.heroEyebrow}</p>
            <h1>
              {t.landing.heroTitle} <span className="glow">{t.landing.heroTitleEmph}</span>
            </h1>
            <p className="mk-lede">{t.landing.heroSubtitle}</p>
            <div className="mk-cta-row">
              <Link className="mk-btn" to="/start">
                {t.landing.heroCta} — ${audit}
              </Link>
              <a className="mk-btn ghost" href="#report">
                {t.landing.sampleCta}
              </a>
            </div>
            <p className="mk-micro">
              One-time purchase · <b>7-day refund</b> · photos deleted after 30 days.
            </p>
          </div>

          <figure className="mk-glass" aria-label="A dating profile with a coaching score">
            <div className="media">
              <span className="chip keep">keep ✓</span>
              <span className="chip swap">swap</span>
              <span className="name">David, 36</span>
              <div className="mk-ringwrap">
                <svg viewBox="0 0 96 96" aria-hidden="true">
                  <circle className="track2" cx="48" cy="48" r="42" />
                  <circle className="prog" cx="48" cy="48" r="42" />
                </svg>
                <span className="n">61</span>
              </div>
            </div>
            <figcaption className="caption">
              <p className="k">Where you stand</p>
              <p className="coachline">
                <span className="badge">On the way up</span> 61 → 85 with 3 quick wins
              </p>
              <p className="sub">
                Strong lead photo. Let&apos;s fix the bio and swap two shots — you&apos;ll feel the
                difference in a week.
              </p>
            </figcaption>
          </figure>
        </section>
      </div>

      {/* SAMPLE REPORT */}
      <section className="mk-band" id="report">
        <div className="mk-wrap">
          <div className="mk-sec-head">
            <p className="mk-eyebrow">{t.landing.reportEyebrow}</p>
            <h2>{t.landing.reportTitle}</h2>
            <p>{t.landing.reportIntro}</p>
          </div>

          <div className="mk-report">
            <div className="aside">
              <span className="mk-stamp">Sample report</span>
              <div className="mk-scorewrap">
                <div className="mk-ring2">
                  <svg viewBox="0 0 96 96" aria-hidden="true">
                    <circle className="t" cx="48" cy="48" r="42" />
                    <circle className="p" cx="48" cy="48" r="42" />
                  </svg>
                  <span className="n">61</span>
                </div>
                <div className="meta">
                  <div className="to">Climbing to 85</div>
                  <div className="cap">3 quick wins away</div>
                </div>
              </div>
              <div className="mk-barline">
                <Bar label="Photo 1" value={82} good />
                <Bar label="Photo 2" value={44} />
                <Bar label="Photo 3" value={38} />
                <Bar label="Bio" value={55} />
                <Bar label="Prompts" value={70} good />
              </div>
            </div>

            <div className="body">
              <div className="mk-diag">
                <h4>Diagnosis</h4>
                <p>
                  Your first photo is doing all the work — sharp, warm, real eye contact. Photos 2
                  and 3 repeat the same angle in dim light. Your bio lists traits instead of showing
                  them, so it reads like everyone else&apos;s.
                </p>
              </div>
              <div className="mk-diag">
                <h4>
                  <span className="pen-ic">✎</span>Bio — marked up
                </h4>
                <div className="mk-rewrite">
                  <p className="old">
                    &quot;I like <s>good conversation, travel, and good food.</s>&quot;
                  </p>
                  <p className="mk-pen-note">
                    Everyone writes this. What&apos;s a story only you could tell?
                  </p>
                  <p className="new">
                    &quot;I build bridges for a living and lose every argument to my rescue dog. Ask
                    me about the worst empanada I&apos;ve had in 12 countries.&quot;
                  </p>
                </div>
              </div>
              <div className="mk-diag">
                <h4>Your 5-step action plan</h4>
                <ol className="mk-plan">
                  <li>Replace Photo 3 with a full-body shot in daylight.</li>
                  <li>Cut Photo 2 — it duplicates Photo 1&apos;s angle.</li>
                  <li>Swap the trait-list bio for the rewrite above.</li>
                  <li>Add a prompt about the empanada story — it invites a reply.</li>
                  <li>Lead with the photo scored 82. It&apos;s your opener.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI PHOTOS */}
      <section className="mk-band alt">
        <div className="mk-wrap">
          <div className="mk-sec-head">
            <p className="mk-eyebrow">{t.landing.photosEyebrow}</p>
            <h2>{t.landing.photosTitle}</h2>
            <p>{t.landing.photosIntro}</p>
          </div>
          <div className="mk-plates">
            <div className="mk-plate a">
              <span>Golden hour</span>
            </div>
            <div className="mk-plate b">
              <span>Warm café</span>
            </div>
            <div className="mk-plate c">
              <span>Studio</span>
            </div>
            <div className="mk-plate d">
              <span>City evening</span>
            </div>
          </div>
          <p className="mk-guard">
            <b>{t.landing.photosGuardLabel}</b>&nbsp;{t.landing.photosGuardText}
          </p>
        </div>
      </section>

      {/* STEPS */}
      <section className="mk-band">
        <div className="mk-wrap">
          <div className="mk-sec-head">
            <p className="mk-eyebrow">{t.landing.stepsEyebrow}</p>
            <h2>{t.landing.stepsTitle}</h2>
          </div>
          <div className="mk-steps">
            <Step no={1} title={t.landing.step1Title} body={t.landing.step1Body} />
            <Step no={2} title={t.landing.step2Title} body={t.landing.step2Body} />
            <Step no={3} title={t.landing.step3Title} body={t.landing.step3Body} />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="mk-band alt" id="pricing">
        <div className="mk-wrap">
          <div className="mk-sec-head">
            <p className="mk-eyebrow">{t.pricing.eyebrow}</p>
            <h2>{t.pricing.title}</h2>
            <p>{t.pricing.intro}</p>
          </div>
          <div className="mk-prices">
            <div className="mk-price">
              <h3>{t.pricing.audit}</h3>
              <div className="amt">
                ${audit} <small>{t.pricing.oneTime}</small>
              </div>
              <ul>
                <li>{t.pricing.auditPerk1}</li>
                <li>{t.pricing.auditPerk2}</li>
                <li>{t.pricing.auditPerk3}</li>
                <li>{t.pricing.auditPerk4}</li>
              </ul>
              <Link className="mk-btn ghost" to="/start?tier=AUDIT">
                {t.pricing.ctaAudit}
              </Link>
            </div>
            <div className="mk-price feat">
              <span className="ribbon">{t.pricing.ribbon}</span>
              <h3>{t.pricing.auditPlus}</h3>
              <div className="amt">
                ${plus} <small>{t.pricing.oneTime}</small>
              </div>
              <ul>
                <li>{t.pricing.plusPerk1}</li>
                <li>
                  <strong>{t.pricing.plusPerk2}</strong>
                </li>
                <li>{t.pricing.plusPerk3}</li>
                <li>{t.pricing.plusPerk4}</li>
              </ul>
              <Link className="mk-btn" to="/start?tier=AUDIT_PLUS_PHOTOS">
                {t.pricing.ctaPlus}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="mk-band">
        <div className="mk-wrap">
          <div className="mk-sec-head">
            <p className="mk-eyebrow">{t.landing.trustEyebrow}</p>
            <h2>{t.landing.trustTitle}</h2>
            <p>{t.landing.trustIntro}</p>
          </div>
          <div className="mk-trust">
            <Promise ic="🔓" title={t.promises.noSubsTitle} body={t.promises.noSubsBody} />
            <Promise ic="↩️" title={t.promises.refundTitle} body={t.promises.refundBody} />
            <Promise ic="🗑️" title={t.promises.deleteTitle} body={t.promises.deleteBody} />
            <Promise ic="🙂" title={t.promises.neverTitle} body={t.promises.neverBody} />
          </div>
          <p className="mk-note">
            {t.landing.trustNoteLead}
            <span className="hl">{t.landing.trustNote}</span>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mk-band alt" id="faq">
        <div className="mk-wrap">
          <div className="mk-sec-head">
            <p className="mk-eyebrow">FAQ</p>
            <h2>{t.landing.faqTitle}</h2>
          </div>
          <div className="mk-faq">
            {FAQ.map((item, i) => (
              <details key={item.q} open={i === 0}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mk-final">
        <div className="mk-wrap">
          <p className="mk-eyebrow" style={{ textAlign: 'center' }}>
            Ready?
          </p>
          <h2>{t.landing.finalTitle}</h2>
          <p>{t.landing.finalSub}</p>
          <Link className="mk-btn" to="/start">
            {t.landing.heroCta} — ${audit}
          </Link>
        </div>
      </section>
    </Layout>
  );
}

function Bar({ label, value, good }: { label: string; value: number; good?: boolean }) {
  return (
    <div className="mk-bar">
      <span>{label}</span>
      <span className="track">
        <span className={`fill${good ? ' g' : ''}`} style={{ width: `${value}%` }} />
      </span>
      <span className="v">{value}</span>
    </div>
  );
}

function Step({ no, title, body }: { no: number; title: string; body: string }) {
  return (
    <div className="mk-step">
      <div className="no">{no}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function Promise({ ic, title, body }: { ic: string; title: string; body: string }) {
  return (
    <div className="mk-promise">
      <div className="ic">{ic}</div>
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}
