/* =====================================================
   GRAFTA — landing.js (hybrid design animations)
   Initialized lazily when #viewSignin becomes visible.
   Listens for 'grafta:init-landing' custom event from app.js.
   ===================================================== */

(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let initialized = false;

  function initAll() {
    if (initialized) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      // GSAP not yet loaded — retry shortly
      setTimeout(initAll, 100);
      return;
    }
    const view = document.getElementById('viewSignin');
    if (!view) return;
    if (view.classList.contains('hidden')) return; // defer until shown
    initialized = true;

    gsap.registerPlugin(ScrollTrigger);

    buildTicker();
    initBlob();
    initTickerScroll();
    initHeroFade();
    initFlipCards();
    initSectionFades();
    initPrivacy();
    initAnalyticsCols();
    initNavShadow();
  }

  /* ── 1. Blob morphing ── */
  function initBlob() {
    if (reducedMotion) return;
    const blobPath = document.querySelector('#viewSignin .gh-blob-path');
    const blobSvg  = document.querySelector('#viewSignin .gh-blob-svg');
    if (!blobPath) return;

    const shapes = [
      "M360,80 C480,40 600,110 610,230 C620,350 550,460 430,490 C310,520 170,490 120,385 C70,280 110,145 210,100 C275,70 290,105 360,80 Z",
      "M400,65 C530,30 610,155 595,280 C580,405 490,475 360,488 C230,501 120,445 90,335 C60,225 120,110 230,82 C305,60 330,88 400,65 Z",
      "M310,95 C420,30 565,90 600,210 C635,330 580,460 450,492 C320,524 175,500 125,395 C75,290 105,155 195,100 C250,68 255,130 310,95 Z",
      "M380,55 C510,20 620,130 615,265 C610,400 520,470 385,495 C250,520 130,470 95,352 C60,234 115,108 240,75 C310,52 305,77 380,55 Z",
      "M335,90 C455,45 580,125 600,255 C620,385 545,470 415,498 C285,526 155,488 110,375 C65,262 100,130 205,88 C268,62 278,118 335,90 Z",
    ];
    let current = 0;
    function morphToNext() {
      current = (current + 1) % shapes.length;
      gsap.to(blobPath, {
        duration: 4,
        ease: 'power1.inOut',
        attr: { d: shapes[current] },
        onComplete: morphToNext,
      });
    }
    if (blobSvg) {
      gsap.to(blobSvg, {
        rotation: 360,
        duration: 28,
        ease: 'none',
        repeat: -1,
        transformOrigin: '50% 50%',
      });
      gsap.to('#viewSignin .gh-blob-wrap', {
        yPercent: -35,
        ease: 'none',
        scrollTrigger: {
          trigger: '#viewSignin .gh-hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 1.2,
        },
      });
    }
    gsap.delayedCall(0.5, morphToNext);
  }

  /* ── 2. Ticker entries (DOM build) ── */
  function buildTicker() {
    const track = document.getElementById('ghTickerTrack');
    if (!track || track.childElementCount > 0) return;

    const entries = [
      { name: 'Tacrolimus',    value: '2 mg',       time: '08:00' },
      { name: 'BP',            value: '118/74',     time: '08:15' },
      { name: 'Creatinine',    value: '1.1 mg/dL',  time: '07:30' },
      { name: 'eGFR',          value: '68 mL/min',  time: '07:30' },
      { name: 'Weight',        value: '74.2 kg',    time: '07:45' },
      { name: 'Mycophenolate', value: '500 mg',     time: '08:00' },
      { name: 'Prednisolone',  value: '5 mg',       time: '08:00' },
      { name: 'BP',            value: '121/76',     time: '20:10' },
      { name: 'Tacrolimus',    value: '2 mg',       time: '20:00' },
      { name: 'Hemoglobin',    value: '13.4 g/dL',  time: '07:30' },
      { name: 'Potassium',     value: '4.2 mmol/L', time: '07:30' },
      { name: 'Weight',        value: '74.0 kg',    time: '07:50' },
    ];

    function makeEntry(e) {
      const el = document.createElement('div');
      el.className = 'gh-ticker-entry';
      const name = document.createElement('span');
      name.className = 'gh-te-name';
      name.textContent = e.name;
      const val = document.createElement('span');
      val.className = 'gh-te-value';
      val.textContent = e.value;
      const time = document.createElement('span');
      time.className = 'gh-te-time';
      time.textContent = e.time;
      const check = document.createElement('span');
      check.className = 'gh-te-check';
      check.textContent = '✓';
      el.appendChild(name);
      el.appendChild(val);
      el.appendChild(time);
      el.appendChild(check);
      return el;
    }

    // 3× for seamless loop
    const all = [...entries, ...entries, ...entries];
    all.forEach(e => track.appendChild(makeEntry(e)));
    track.dataset.setCount = String(entries.length);
  }

  /* ── 3. Ticker scroll ── */
  function initTickerScroll() {
    const track = document.getElementById('ghTickerTrack');
    if (!track) return;
    if (reducedMotion) return;

    const setCount = parseInt(track.dataset.setCount || '12', 10);
    let setHeight = 0;
    let animId = null;
    let offset = 0;
    let lastTime = null;
    const SPEED = 22; // px/s

    function measureSet() {
      const children = Array.from(track.children);
      setHeight = children.slice(0, setCount).reduce((s, c) => s + c.offsetHeight, 0);
    }

    function tick(ts) {
      if (!lastTime) lastTime = ts;
      const delta = (ts - lastTime) / 1000;
      lastTime = ts;
      offset += SPEED * delta;
      if (setHeight > 0 && offset >= setHeight) offset -= setHeight;
      track.style.transform = `translateY(-${offset}px)`;
      animId = requestAnimationFrame(tick);
    }

    requestAnimationFrame(() => {
      measureSet();
      animId = requestAnimationFrame(tick);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (animId) cancelAnimationFrame(animId);
        animId = null;
        lastTime = null;
      } else if (!animId) {
        animId = requestAnimationFrame(tick);
      }
    });
  }

  /* ── 4. Hero text fade-up on load ── */
  function initHeroFade() {
    const elements = document.querySelectorAll('#viewSignin .gh-hero .gh-fade-up, #viewSignin .gh-hero-right');
    if (!elements.length) return;
    if (reducedMotion) {
      gsap.set(elements, { opacity: 1, y: 0 });
      return;
    }
    gsap.set(elements, { opacity: 0, y: 36 });
    gsap.to(elements, {
      opacity: 1,
      y: 0,
      duration: 0.85,
      ease: 'power2.out',
      stagger: 0.15,
      delay: 0.2,
    });
  }

  /* ── 5. Flip cards ── */
  function initFlipCards() {
    const cards = document.querySelectorAll('#viewSignin .gh-js-flip-card');
    if (!cards.length) return;
    if (reducedMotion) {
      gsap.set(cards, { opacity: 1, y: 0 });
    } else {
      gsap.set(cards, { opacity: 0, y: 50 });
      ScrollTrigger.create({
        trigger: '#viewSignin .gh-flip-grid',
        start: 'top 80%',
        once: true,
        onEnter: () => {
          gsap.to(cards, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power2.out',
            stagger: 0.1,
          });
        },
      });
    }
    cards.forEach(card => {
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.classList.toggle('gh-flipped');
        }
      });
    });
  }

  /* ── 6. Section fade-ups ── */
  function initSectionFades() {
    const targets = document.querySelectorAll(
      '#viewSignin .gh-track-section .gh-fade-up, ' +
      '#viewSignin .gh-analytics-section .gh-fade-up, ' +
      '#viewSignin .gh-cta-band .gh-fade-up, ' +
      '#viewSignin .gh-analytics-consent'
    );
    if (!targets.length) return;
    if (reducedMotion) {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }
    gsap.set(targets, { opacity: 0, y: 30 });
    targets.forEach(el => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => {
          gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' });
        },
      });
    });
  }

  /* ── 7. Privacy fade-ups + lock draw ── */
  function initPrivacy() {
    const privFades = document.querySelectorAll('#viewSignin .gh-privacy-section .gh-fade-up');
    if (reducedMotion) {
      gsap.set(privFades, { opacity: 1, y: 0 });
      document.querySelectorAll('#viewSignin .gh-lock-stroke').forEach(s => {
        s.style.strokeDashoffset = 0;
      });
      return;
    }
    gsap.set(privFades, { opacity: 0, y: 28 });
    ScrollTrigger.create({
      trigger: '#viewSignin .gh-privacy-section',
      start: 'top 75%',
      once: true,
      onEnter: () => {
        gsap.to(privFades, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power2.out',
          stagger: 0.12,
        });
      },
    });
    const lockStrokes = document.querySelectorAll('#viewSignin .gh-lock-stroke');
    if (!lockStrokes.length) return;
    lockStrokes.forEach(s => {
      let len;
      try { len = s.getTotalLength(); } catch (e) { len = 600; }
      gsap.set(s, { strokeDasharray: len, strokeDashoffset: len });
    });
    ScrollTrigger.create({
      trigger: '#viewSignin #ghLockSvg',
      start: 'top 80%',
      end: 'bottom 40%',
      scrub: 1.2,
      onUpdate: self => {
        lockStrokes.forEach(s => {
          let len;
          try { len = s.getTotalLength(); } catch (e) { len = 600; }
          gsap.set(s, { strokeDashoffset: len * (1 - self.progress) });
        });
      },
    });
  }

  /* ── 8. Analytics columns slide-in ── */
  function initAnalyticsCols() {
    const left  = document.querySelector('#viewSignin .gh-analytics-col.gh-left');
    const right = document.querySelector('#viewSignin .gh-analytics-col.gh-right');
    if (!left || !right) return;
    if (reducedMotion) {
      gsap.set([left, right], { opacity: 1, x: 0 });
      return;
    }
    gsap.set(left,  { opacity: 0, x: -70 });
    gsap.set(right, { opacity: 0, x:  70 });
    ScrollTrigger.create({
      trigger: '#viewSignin .gh-analytics-grid',
      start: 'top 82%',
      once: true,
      onEnter: () => {
        gsap.to(left,  { opacity: 1, x: 0, duration: 0.75, ease: 'power2.out' });
        gsap.to(right, { opacity: 1, x: 0, duration: 0.75, ease: 'power2.out', delay: 0.1 });
      },
    });
  }

  /* ── 9. Nav shadow on scroll ── */
  function initNavShadow() {
    const nav = document.querySelector('#viewSignin .gh-nav');
    if (!nav) return;
    ScrollTrigger.create({
      start: 'top -60',
      onUpdate: self => {
        nav.style.boxShadow = self.progress > 0
          ? '0 2px 20px rgba(15,38,34,0.08)'
          : 'none';
      },
    });
  }

  // Expose for app.js to call after showView('viewSignin')
  document.addEventListener('grafta:init-landing', initAll);

  // Also try on DOMContentLoaded in case viewSignin is visible at boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initAll, 50));
  } else {
    setTimeout(initAll, 50);
  }
})();
