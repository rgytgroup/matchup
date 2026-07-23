import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TIERS } from '@matchup/shared';
import { Layout } from '../components/Layout';
import { track } from '../api';

const RING = 2 * Math.PI * 42;

const FAQ: Array<{ q: string; a: string }> = [
  { q: 'Is this a subscription?', a: 'No. Truly is a one-time purchase. No recurring charges, ever.' },
  { q: 'What exactly do I get?', a: 'An overall score, a score for each photo, a bio diagnosis, three rewritten bios, suggested prompts, and a 5-step action plan. The premium tier adds 30 new AI photos of you.' },
  { q: 'How do the AI photos work?', a: 'You upload photos you already have; we generate 30 of you in better settings. We change context, clothing and lighting — never your actual features.' },
  { q: 'Can I get a refund?', a: "Yes. If you're not satisfied, request a refund within 7 days." },
  { q: 'What happens to my photos?', a: "They're used only to build your report, and everything is deleted after 30 days." },
];

const WHAT_YOU_GET = [
  { ic: '◎', t: 'Honest score', d: "A clear score and a plan that shows you what's holding you back." },
  { ic: '▣', t: 'Photo-by-photo feedback', d: 'Know which photos to keep, which to rethink, and why.' },
  { ic: '✎', t: 'Stronger bio & prompts', d: 'Rewritten bios and prompt ideas that sound like you, just better.' },
  { ic: '☑', t: 'Action plan', d: 'A 5-step plan you can follow today to see real results.' },
  { ic: '✦', t: 'AI photos (premium)', d: '40–60 new, natural photos of you in your best light.' },
];

export function Landing() {
  const audit = TIERS.AUDIT.priceUsd.toFixed(2);
  const plus = TIERS.AUDIT_PLUS_PHOTOS.priceUsd.toFixed(2);

  useEffect(() => {
    track('landing.visit');
    track('visit');
  }, []);

  return (
    <Layout>
      {/* ---- HERO ---- */}
      <section className="mk-wrap mk-l2-hero">
        <div className="mk-l2-hero-copy">
          <p className="mk-eyebrow">Honest advice · real results</p>
          <h1>
            Your best profile, <span className="glow">on purpose.</span>
          </h1>
          <p className="mk-lede">
            Screenshot your dating profile and get a coach&apos;s honest audit — scores, a plan,
            rewritten bios, and new photos that actually match you.
          </p>
          <div className="mk-cta-row">
            <Link className="mk-btn" to="/start">Audit my profile — ${audit}</Link>
            <Link className="mk-btn ghost" to="/sample">See sample report</Link>
          </div>
          <p className="mk-micro">One-time purchase · <b>7-day refund</b> · photos deleted after 30 days.</p>
        </div>

        {/* Dashboard card */}
        <div className="mk-l2-dash">
          <div className="top">
            <div className="mk-l2-ring">
              <span className="lbl">Your score</span>
              <div className="ring">
                <svg viewBox="0 0 96 96" aria-hidden="true">
                  <circle className="t" cx="48" cy="48" r="42" />
                  <circle className="p" cx="48" cy="48" r="42" style={{ strokeDashoffset: RING * (1 - 64 / 100) }} />
                </svg>
                <span className="n">64<small>/100</small></span>
              </div>
            </div>
            <div className="pot">
              <span className="lbl">Your potential ✦</span>
              <span className="val">91<small>/100</small></span>
              <p>Great profiles get more right swipes and better conversations.</p>
              <svg className="mk-r2-curve" viewBox="0 0 120 34" aria-hidden="true">
                <defs>
                  <marker id="ah-l" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
                    <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--win)" />
                  </marker>
                </defs>
                <path d="M6,28 Q74,28 106,9" fill="none" stroke="var(--win)" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#ah-l)" />
              </svg>
            </div>
          </div>
          <div className="kpis">
            <MiniKpi label="Photos" score={72} sug={5} />
            <MiniKpi label="Bio" score={48} sug={5} />
            <MiniKpi label="Prompts" score={61} sug={4} />
          </div>
          <div className="foot">
            <span>✦ Based on your photos, bio &amp; prompts</span>
            <span>Optimized for Tinder 🔥</span>
          </div>
        </div>
      </section>

      {/* ---- WHAT YOU GET ---- */}
      <section className="mk-band" id="what">
        <div className="mk-wrap">
          <p className="mk-eyebrow" style={{ textAlign: 'center' }}>What you get</p>
          <div className="mk-l2-features">
            {WHAT_YOU_GET.map((f) => (
              <div key={f.t} className="feat">
                <span className="ic">{f.ic}</span>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- BEFORE / AFTER ---- */}
      <section className="mk-band alt">
        <div className="mk-wrap mk-l2-ba">
          <div className="photos">
            <div className="ph before" style={{ background: "url('/persona/city.jpg') center/cover" }}><span>BEFORE</span></div>
            <div className="ph after" style={{ background: "url('/persona/hero.jpg') center/cover" }}><span className="g">AFTER</span></div>
          </div>
          <div className="mk-card compare">
            <div className="col">
              <div className="hd"><span className="ttl">Before</span><span className="badge red">58/100</span></div>
              <BaRow label="Photos" v={45} tone="red" />
              <BaRow label="Bio" v={40} tone="red" />
              <BaRow label="Prompts" v={50} tone="red" />
            </div>
            <span className="arrow">→</span>
            <div className="col">
              <div className="hd"><span className="ttl">After <small>(with our plan)</small></span><span className="badge green">94/100</span></div>
              <BaRow label="Photos" v={91} tone="green" />
              <BaRow label="Bio" v={90} tone="green" />
              <BaRow label="Prompts" v={94} tone="green" />
            </div>
          </div>
          <p className="mk-hint" style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '.5rem' }}>
            Example results from a sample profile (Mateo). Your results will be based on your profile.
          </p>
        </div>
      </section>

      {/* ---- HOW IT WORKS ---- */}
      <section className="mk-band" id="how">
        <div className="mk-wrap">
          <p className="mk-eyebrow">How it works</p>
          <h2 className="mk-l2-h2">Three simple steps.</h2>
          <div className="mk-l2-steps">
            <div className="mk-card step"><span className="no">1</span><h3>Screenshot your profile</h3><p>Upload screenshots of your profile, bio, and prompts. We&apos;ll extract everything for you.</p></div>
            <div className="mk-card step"><span className="no">2</span><h3>We analyze &amp; grade it</h3><p>Our AI coach reviews your photos, bio, and prompts to find what&apos;s working and what&apos;s not.</p></div>
            <div className="mk-card step"><span className="no">3</span><h3>Get your report</h3><p>Your score, feedback, rewrites, and a 5-step plan to level up your profile.</p></div>
            <div className="mk-card step privacy"><h3>🛡 Privacy first, always.</h3><p>We only analyze your profile. Your photos are deleted automatically after 30 days. No data is shared. Ever.</p></div>
          </div>
        </div>
      </section>

      {/* ---- PRICING ---- */}
      <section className="mk-band alt" id="pricing">
        <div className="mk-wrap">
          <p className="mk-eyebrow">Pricing</p>
          <h2 className="mk-l2-h2">One payment. Pick your depth.</h2>
          <div className="mk-prices">
            <div className="mk-price">
              <h3>Profile Audit</h3>
              <div className="amt">${audit} <small>one-time</small></div>
              <ul>
                <li>Overall score + improvement plan</li>
                <li>Photo-by-photo feedback</li>
                <li>Stronger bio &amp; prompt ideas</li>
                <li>Your 5-step action plan</li>
              </ul>
              <Link className="mk-btn ghost" to="/start?tier=AUDIT">Choose Audit</Link>
            </div>
            <div className="mk-price feat">
              <span className="ribbon">Best value</span>
              <h3>Audit + AI Photos</h3>
              <div className="amt">${plus} <small>one-time</small></div>
              <ul>
                <li>Everything in the audit</li>
                <li><strong>30 brand-new AI photos of you</strong></li>
                <li>Hand-picked, your best light</li>
                <li>Your real features, always kept</li>
              </ul>
              <Link className="mk-btn" to="/start?tier=AUDIT_PLUS_PHOTOS">Choose Audit + Photos</Link>
            </div>
            <div className="mk-card mk-l2-honest">
              <h3>Honest beats flattering.</h3>
              <p>We don&apos;t tell you what you want to hear. We tell you what works.</p>
              <div className="promises">
                <div><span className="ic">🔓</span><b>No subscriptions</b><span>One payment.</span></div>
                <div><span className="ic">↩️</span><b>7-day refund</b><span>Ask within 7 days.</span></div>
                <div><span className="ic">🗑️</span><b>Photos deleted</b><span>After 30 days.</span></div>
                <div><span className="ic">🙂</span><b>Never altered</b><span>Your real features.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="mk-band" id="faq">
        <div className="mk-wrap">
          <p className="mk-eyebrow">FAQ</p>
          <h2 className="mk-l2-h2">Straight answers.</h2>
          <div className="mk-faq">
            {FAQ.map((item, i) => (
              <details key={item.q} open={i === 0}><summary>{item.q}</summary><p>{item.a}</p></details>
            ))}
          </div>
        </div>
      </section>

      {/* ---- FINAL ---- */}
      <section className="mk-final">
        <div className="mk-wrap">
          <p className="mk-eyebrow" style={{ textAlign: 'center' }}>Ready?</p>
          <h2>See what your profile really says.</h2>
          <p>Ten minutes. One honest report. Better matches.</p>
          <Link className="mk-btn" to="/start">Audit my profile — ${audit}</Link>
        </div>
      </section>
    </Layout>
  );
}

function MiniKpi({ label, score, sug }: { label: string; score: number; sug: number }) {
  return (
    <div className="mk-l2-mkpi">
      <span className="lbl">{label}</span>
      <span className="sc">{score}<small>/100</small></span>
      <span className="sug">{sug} suggestions</span>
    </div>
  );
}

function BaRow({ label, v, tone }: { label: string; v: number; tone: 'red' | 'green' }) {
  return (
    <div className="mk-l2-barow">
      <span className="lbl">{label}</span>
      <span className="track"><span className="fill" style={{ width: `${v}%`, background: tone === 'green' ? 'var(--win)' : 'var(--pen)' }} /></span>
      <span className="v">{v}</span>
    </div>
  );
}
