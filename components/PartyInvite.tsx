'use client';

// heyrhai.com/party — the launch-party invite as a scroll-driven 3D journey.
// One field of ~10k glowing particles morphs through the story as you scroll:
// the Claude spark → a universe of stars → a neural constellation → the
// roman numeral X (episode ten) → ignition — and lands on the reveal + RSVP.
// Dark, luxe, one orange. Built to be opened from WhatsApp on a phone.

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const ORANGE = '#d97757';
const CREAM = '#f4efe6';
const MUTED = '#b0a695';

// ---------------------------------------------------------------------------
// Particle shape targets
// ---------------------------------------------------------------------------

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.8;

/** The group spins with scroll (rotation.y = progress × 1.3). Shapes meant to
 *  be read face-on get counter-rotated at build time so they face the camera
 *  exactly at their station. */
function rotY(arr: Float32Array, angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i];
    const z = arr[i + 2];
    arr[i] = x * c + z * s;
    arr[i + 2] = -x * s + z * c;
  }
  return arr;
}

/** The Claude spark — 8 hand-drawn-ish rays around a dense core. */
function makeSpark(n: number, radius: number, coreShare: number): Float32Array {
  const arr = new Float32Array(n * 3);
  const rays = 8;
  const len: number[] = [];
  const ang: number[] = [];
  for (let k = 0; k < rays; k++) {
    const h = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1;
    len.push(radius * (0.7 + 0.4 * h));
    ang.push((k / rays) * Math.PI * 2 + (h - 0.5) * 0.14);
  }
  const nCore = Math.floor(n * coreShare);
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (i < nCore) {
      x = gauss() * 2.1;
      y = gauss() * 2.1;
      z = gauss() * 1.3;
    } else {
      const k = i % rays;
      const t = Math.pow(Math.random(), 0.7);
      const r = t * len[k];
      const spread = (1 - t) * 0.55 + 0.05; // rays taper to a point
      x = Math.cos(ang[k]) * r + gauss() * spread;
      y = Math.sin(ang[k]) * r + gauss() * spread;
      z = gauss() * 0.5;
    }
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z;
  }
  return arr;
}

/** A universe — particles filling a deep sphere you can fly inside. */
function makeStars(n: number): Float32Array {
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 4 + 25 * Math.cbrt(Math.random());
    arr[i * 3] = s * Math.cos(th) * r;
    arr[i * 3 + 1] = s * Math.sin(th) * r * 0.85;
    arr[i * 3 + 2] = u * r;
  }
  return arr;
}

/** A neural constellation — clustered nodes (+ the edge list to draw). */
function makeNetwork(n: number): { positions: Float32Array; edges: Float32Array } {
  // A flat-ish constellation map seen face-on — a sphere would project its
  // front and back into mush. Dart-throwing keeps every knot clearly apart.
  const nodeCount = 64;
  const nodes: [number, number, number][] = [];
  for (let k = 0; k < nodeCount; k++) {
    let placed: [number, number, number] | null = null;
    for (let tries = 0; tries < 60 && !placed; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 11 * Math.sqrt(Math.random());
      const cand: [number, number, number] = [Math.cos(a) * r, Math.sin(a) * r * 0.72, gauss() * 1.3];
      if (nodes.every(p => (p[0] - cand[0]) ** 2 + (p[1] - cand[1]) ** 2 > 4.4)) placed = cand;
    }
    if (placed) nodes.push(placed);
  }
  const placedCount = nodes.length; // dart throwing may place fewer than asked
  const positions = new Float32Array(n * 3);
  const brightShare = Math.floor(n * 0.58); // tail indices = the faint dust class
  // Each node is a tight stack of a few sprites — additive blending turns the
  // stack into one clean glowing dot (bright core, soft halo), not a splat.
  const perNode = 6;
  const nodeParticles = placedCount * perNode;
  for (let i = 0; i < n; i++) {
    if (i < nodeParticles) {
      const nd = nodes[Math.floor(i / perNode)];
      positions[i * 3] = nd[0] + gauss() * 0.07;
      positions[i * 3 + 1] = nd[1] + gauss() * 0.07;
      positions[i * 3 + 2] = nd[2] + gauss() * 0.07;
    } else if (i < brightShare) {
      // Surplus bright particles recede into a deep far shell — the universe
      // pulls back and leaves only the constellation.
      const u = Math.random() * 2 - 1;
      const th2 = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 32 + 16 * Math.cbrt(Math.random());
      positions[i * 3] = s * Math.cos(th2) * r;
      positions[i * 3 + 1] = s * Math.sin(th2) * r * 0.8;
      positions[i * 3 + 2] = u * r;
    } else {
      const u = Math.random() * 2 - 1;
      const th2 = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 14 + 10 * Math.cbrt(Math.random());
      positions[i * 3] = s * Math.cos(th2) * r;
      positions[i * 3 + 1] = s * Math.sin(th2) * r * 0.8;
      positions[i * 3 + 2] = u * r;
    }
  }
  // Each node connects to its 2 nearest siblings — the synapse lines.
  const seen = new Set<string>();
  const edgePts: number[] = [];
  for (let a = 0; a < placedCount; a++) {
    const dists = nodes
      .map((p, b) => ({ b, d: (p[0] - nodes[a][0]) ** 2 + (p[1] - nodes[a][1]) ** 2 + (p[2] - nodes[a][2]) ** 2 }))
      .filter(e => e.b !== a)
      .sort((x, y) => x.d - y.d)
      .slice(0, 3);
    for (const { b } of dists) {
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edgePts.push(...nodes[a], ...nodes[b]);
    }
  }
  return { positions, edges: new Float32Array(edgePts) };
}

/** Particles sampled from a big serif glyph (the roman numeral X). */
function makeGlyph(n: number, char: string, fallback: Float32Array): Float32Array {
  try {
    const size = 220;
    const cnv = document.createElement('canvas');
    cnv.width = size;
    cnv.height = size;
    const ctx = cnv.getContext('2d');
    if (!ctx) return fallback;
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${size * 0.92}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, size / 2, size * 0.56);
    const img = ctx.getImageData(0, 0, size, size).data;
    const pts: [number, number][] = [];
    for (let y = 0; y < size; y += 2)
      for (let x = 0; x < size; x += 2) if (img[(y * size + x) * 4 + 3] > 140) pts.push([x, y]);
    if (pts.length < 50) return fallback;
    const arr = new Float32Array(n * 3);
    const scale = 17 / size;
    for (let i = 0; i < n; i++) {
      const [px, py] = pts[Math.floor(Math.random() * pts.length)];
      arr[i * 3] = (px - size / 2) * scale + gauss() * 0.1;
      arr[i * 3 + 1] = -(py - size / 2) * scale + gauss() * 0.1;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
    }
    return arr;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Scroll timeline — which shape at which scroll depth, and the camera ride
// ---------------------------------------------------------------------------

// Each scene gets a HOLD (aligned to its copy beat) with morphs between —
// centers land where the text sections sit: stars .18, net .37, X .57, fire .76.
const KEY_P = [0, 0.06, 0.14, 0.22, 0.33, 0.41, 0.52, 0.61, 0.72, 1.001];
const KEY_SHAPE = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]; // spark stars net glyph ignition
const KEY_CAMZ = [26, 26, 15, 16, 30, 30, 27, 27, 19, 26];

const VERT = `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTw;
void main() {
  vColor = aColor;
  vec3 p = position;
  p.x += sin(uTime * 0.55 + aPhase) * 0.14;
  p.y += cos(uTime * 0.45 + aPhase * 1.7) * 0.14;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * uPixelRatio * (30.0 / -mv.z);
  vTw = 0.72 + 0.28 * sin(uTime * 2.1 + aPhase * 3.1);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
varying vec3 vColor;
varying float vTw;
uniform float uOpacity;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.44, 0.05, d);
  a *= a;
  gl_FragColor = vec4(vColor, a * uOpacity * vTw);
}`;

// ---------------------------------------------------------------------------

const EVENT_START_UTC = '2026-07-18T09:30:00Z'; // 3:00 PM IST
const MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent('1391, 3rd Cross, 9th Main, Judicial Layout, Bengaluru 560065');
const CAL_URL =
  'https://calendar.google.com/calendar/render?action=TEMPLATE' +
  `&text=${encodeURIComponent('Rhai Launch Party · Hang w AI, Episode X')}` +
  '&dates=20260718T093000Z/20260718T133000Z' +
  `&details=${encodeURIComponent("You're on the list. Special news, shared in person. — heyrhai.com/party")}` +
  `&location=${encodeURIComponent('1391, 3rd Cross, 9th Main, Judicial Layout, Bengaluru 560065')}`;

const TYPED_LINE = '> loading celebration.exe · guests: 100 · surprise: [REDACTED]';

export function PartyInvite() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const secRefs = useRef<(HTMLElement | null)[]>([]);
  const burstRef = useRef<number>(0); // timestamp of RSVP-success burst
  const [webglOk, setWebglOk] = useState(true);
  const [typed, setTyped] = useState('');
  const [showJump, setShowJump] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [left, setLeft] = useState<{ d: string; h: string; m: string; s: string } | null>(null);

  // RSVP form
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [guests, setGuests] = useState<1 | 2>(1);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');
  const [wasUpdate, setWasUpdate] = useState(false);

  const setSec = (i: number) => (el: HTMLElement | null) => {
    secRefs.current[i] = el;
  };

  // ------------------------------------------------------------------ scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setWebglOk(false);
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = window.innerWidth < 768;
    const N = small ? 6000 : 10000;

    // Review hook: ?p=0.42 pins the journey to that progress (and hides the
    // copy) so any scene can be screenshotted without scrolling.
    const pinned = (() => {
      const v = parseFloat(new URLSearchParams(window.location.search).get('p') ?? '');
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null;
    })();
    if (pinned !== null) document.querySelector<HTMLElement>('.party-main')?.style.setProperty('visibility', 'hidden');

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 140);
    camera.position.z = KEY_CAMZ[0];
    const group = new THREE.Group();
    scene.add(group);

    // Shape targets
    const spark = makeSpark(N, 10, 0.22);
    const stars = makeStars(N);
    const net = makeNetwork(N);
    const glyph = makeGlyph(N, 'X', spark);
    const ignition = makeSpark(N, 6.5, 0.52);
    // Face-on at their stations (see rotY): network ~p=.37, glyph ~p=.57,
    // ignition ~p=.76 — counter the scroll spin of progress × 1.3.
    rotY(net.positions, -0.37 * 1.3);
    rotY(net.edges, -0.37 * 1.3);
    rotY(glyph, -0.57 * 1.3);
    rotY(ignition, -0.76 * 1.3);
    const shapes = [spark, stars, net.positions, glyph, ignition];

    // Particle attributes
    const positions = new Float32Array(spark); // start on the spark
    const sizes = new Float32Array(N);
    const colors = new Float32Array(N * 3);
    const phases = new Float32Array(N);
    // Brightness classes are index-correlated: the tail 42% of indices are the
    // faint background dust in EVERY scene (and exactly the particles the
    // network shape scatters wide) — so bright knots stay legible against them.
    for (let i = 0; i < N; i++) {
      const dustClass = i >= N * 0.58;
      const r = Math.random();
      let c: [number, number, number];
      if (i < 400) {
        // The constellation-node sprites (first placedCount×6 indices) — a big
        // soft halo + small hot cores per node, chapel-style. In other scenes
        // they just read as the brightest sparkles.
        c = i % 6 < 2 ? [0.97, 0.9, 0.78] : [0.9, 0.55, 0.4];
        sizes[i] = i % 6 === 0 ? 15 + Math.random() * 6 : 5 + Math.random() * 4;
        colors[i * 3] = c[0];
        colors[i * 3 + 1] = c[1];
        colors[i * 3 + 2] = c[2];
        phases[i] = Math.random() * Math.PI * 2;
        continue;
      }
      if (dustClass) {
        c = r < 0.6 ? [0.4, 0.24, 0.17] : [0.3, 0.27, 0.23]; // faint ember / ash
        sizes[i] = 2.2 + Math.pow(Math.random(), 2) * 4;
      } else {
        if (r < 0.44) c = [0.851, 0.467, 0.341]; // the orange — leads
        else if (r < 0.6) c = [0.72, 0.34, 0.2]; // deep ember
        else if (r < 0.68) c = [0.95, 0.88, 0.78]; // bright sparkles
        else c = [0.62, 0.45, 0.33]; // warm glow
        sizes[i] = 3.6 + Math.pow(Math.random(), 2.2) * 10.5 + (Math.random() < 0.02 ? 8 : 0);
      }
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.95 },
        uPixelRatio: { value: renderer.getPixelRatio() }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    group.add(points);

    // Synapse lines (visible only during the network act)
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(net.edges, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#e3b48f'), // pale gold-peach — chapel-style threads
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lines);

    // Interaction state
    let prog = 0;
    let mx = 0,
      my = 0,
      tx = 0,
      ty = 0;
    const onPointer = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      mat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    };
    window.addEventListener('resize', onResize);

    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const clock = new THREE.Clock();
    let raf = 0;
    let lastStamp = Number.NaN;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const t = clock.getElapsedTime();
      mat.uniforms.uTime.value = reduced ? 0 : t;

      // Scroll progress with inertia
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      prog = pinned ?? (reduced ? target : prog + (target - prog) * 0.08);

      // Which morph segment are we in?
      let seg = 0;
      while (seg < KEY_P.length - 2 && prog >= KEY_P[seg + 1]) seg++;
      const lt = (prog - KEY_P[seg]) / (KEY_P[seg + 1] - KEY_P[seg]);
      const e = lt * lt * (3 - 2 * lt); // smoothstep
      const from = shapes[KEY_SHAPE[seg]];
      const to = shapes[KEY_SHAPE[seg + 1]];

      // RSVP-success burst: a radial pop that decays over ~1s
      let burstK = 0;
      if (burstRef.current > 0) {
        const bt = (performance.now() - burstRef.current) / 950;
        if (bt < 1) burstK = Math.sin(bt * Math.PI) * (1 - bt * 0.35);
        else burstRef.current = 0;
      }
      const scale = 1 + burstK * 0.55;

      // Only rewrite + re-upload the buffer when the mix actually changed.
      const arr = posAttr.array as Float32Array;
      const stamp = from === to && burstK === 0 ? seg : Number.NaN;
      if (Number.isNaN(stamp) || stamp !== lastStamp) {
        if (from === to && burstK === 0) arr.set(from);
        else for (let i = 0; i < arr.length; i++) arr[i] = (from[i] + (to[i] - from[i]) * e) * scale;
        posAttr.needsUpdate = true;
        lastStamp = stamp;
      }

      // Camera ride + slow drift
      camera.position.z = KEY_CAMZ[seg] + (KEY_CAMZ[seg + 1] - KEY_CAMZ[seg]) * e;
      mx += (tx - mx) * 0.05;
      my += (ty - my) * 0.05;
      group.rotation.y = prog * 1.3 + mx * 0.22 + (reduced ? 0 : t * 0.02);
      group.rotation.x = -0.05 + my * 0.14;

      // How "network" is the current mix → synapse line opacity
      const sFrom = KEY_SHAPE[seg];
      const sTo = KEY_SHAPE[seg + 1];
      const wNet = sFrom === 2 && sTo === 2 ? 1 : sTo === 2 ? e : sFrom === 2 ? 1 - e : 0;
      lineMat.opacity = wNet * 0.3;

      // Ignition pulse while the reveal is on screen
      const wIgn = sFrom === 4 && sTo === 4 ? 1 : sTo === 4 ? e : sFrom === 4 ? 1 - e : 0;
      group.scale.setScalar(1 + (reduced ? 0 : wIgn * 0.035 * Math.sin(t * 2.4)));

      // Dim the field behind the RSVP card, flash on burst
      const dim = Math.min(1, Math.max(0, (prog - 0.85) / 0.12));
      mat.uniforms.uOpacity.value = 0.95 * (1 - dim * 0.58) + burstK * 0.5;

      // Copy beats fade with distance from viewport middle
      const vh = window.innerHeight;
      secRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        let op: number;
        if (i === secRefs.current.length - 1) {
          op = Math.min(1, Math.max(0, 1 - (r.top - vh * 0.32) / (vh * 0.5))); // final: fade in, stay
        } else {
          const d = Math.abs(r.top + r.height / 2 - vh / 2) / (vh * 0.62);
          op = Math.min(1, Math.max(0, 1 - d));
          op = op * op * (3 - 2 * op);
        }
        el.style.opacity = String(op);
        el.style.transform = `translateY(${(1 - op) * 26}px)`;
      });

      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', onResize);
      geo.dispose();
      lineGeo.dispose();
      mat.dispose();
      lineMat.dispose();
      renderer.dispose();
    };
  }, []);

  // ------------------------------------------------------- hero typewriter
  useEffect(() => {
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const start = setTimeout(function tick() {
      i++;
      setTyped(TYPED_LINE.slice(0, i));
      if (i < TYPED_LINE.length) t = setTimeout(tick, 24 + Math.random() * 40);
    }, 900);
    return () => {
      clearTimeout(start);
      clearTimeout(t);
    };
  }, []);

  // ------------------------------------------------------------- countdown
  useEffect(() => {
    const target = new Date(EVENT_START_UTC).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setLeft(null);
        return;
      }
      const p = (v: number) => String(v).padStart(2, '0');
      setLeft({
        d: p(Math.floor(diff / 86400000)),
        h: p(Math.floor(diff / 3600000) % 24),
        m: p(Math.floor(diff / 60000) % 60),
        s: p(Math.floor(diff / 1000) % 60)
      });
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // -------------------------------------- RSVP jump pill + keep-going nudge
  useEffect(() => {
    let idle: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      setShowJump(y > window.innerHeight * 0.6 && y < max - window.innerHeight * 1.4);
      // If they stall mid-journey (past the hero, before the RSVP), nudge them
      // to keep scrolling so they don't miss the reveal.
      setNudge(false);
      clearTimeout(idle);
      const midJourney = y > window.innerHeight * 0.35 && y < max - window.innerHeight * 1.6;
      if (midJourney) idle = setTimeout(() => setNudge(true), 2600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // First idle nudge if they never scroll at all.
    idle = setTimeout(() => window.scrollY < window.innerHeight * 0.35 && setNudge(true), 4000);
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(idle);
    };
  }, []);

  const submit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      if (status === 'sending') return;
      setError('');
      setStatus('sending');
      try {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, contact, guests })
        });
        if (!res.ok) {
          setError(await res.text());
          setStatus('idle');
          return;
        }
        const j = (await res.json()) as { updated?: boolean };
        setWasUpdate(Boolean(j.updated));
        setStatus('done');
        burstRef.current = performance.now();
      } catch {
        setError('Something hiccuped — try once more?');
        setStatus('idle');
      }
    },
    [name, contact, guests, status]
  );

  const jumpToRsvp = () => document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth' });
  const scrollNudge = () => window.scrollBy({ top: window.innerHeight * 0.92, behavior: 'smooth' });

  return (
    <div className="party-root">
      <style>{CSS}</style>

      {webglOk ? <canvas ref={canvasRef} className="party-canvas" aria-hidden /> : <div className="party-fallback" aria-hidden />}
      <div className="party-veil" aria-hidden />

      <header className="party-chrome">
        <span className="party-mark">
          <span className="party-dot" />
          Rhai
        </span>
        <span className="party-meta">18.07.2026 · BLR</span>
      </header>

      <button type="button" className="party-jump" data-on={showJump && status !== 'done'} onClick={jumpToRsvp}>
        RSVP ↓
      </button>

      {/* Keep-going nudge — appears when the reader stalls mid-journey. */}
      <button type="button" className="party-nudge" data-on={nudge && status !== 'done'} onClick={scrollNudge}>
        keep scrolling <span className="party-nudge-chev">⌄</span>
      </button>

      <main className="party-main">
        <section ref={setSec(0)} className="party-sec party-hero">
          <p className="party-eyebrow">Rhai × Hang w AI · Episode X · by invitation</p>
          <h1 className="party-h1">
            You&rsquo;re
            <br />
            invited.
          </h1>
          <p className="party-typed">
            {typed}
            <span className="party-caret" />
          </p>
          <button type="button" className="party-cue" onClick={scrollNudge}>
            <span className="party-cue-word">scroll to open your invite</span>
            <span className="party-cue-line" />
            <span className="party-cue-chev">⌄</span>
          </button>
        </section>

        <section ref={setSec(1)} className="party-sec">
          <p className="party-eyebrow">The occasion</p>
          <h2 className="party-h2">
            Ten weeks
            <br />
            of Hang w AI.
          </h2>
          <p className="party-sub">Afternoons spent teaching a hundred humans to build with AI — first prompt to shipped product.</p>
        </section>

        <section ref={setSec(2)} className="party-sec">
          <h2 className="party-h2">
            One hundred people,
            <br />
            <em>happily indoctrinated.</em>
          </h2>
          <p className="party-sub">Founders, doctors, designers, students — one big neural network now.</p>
        </section>

        <section ref={setSec(3)} className="party-sec">
          <p className="party-eyebrow">Episode X</p>
          <h2 className="party-h2">Double digits.</h2>
          <p className="party-sub">A milestone worth more than a demo — this one gets a party.</p>
        </section>

        <section ref={setSec(4)} className="party-sec">
          <p className="party-eyebrow">And one more thing…</p>
          <h2 className="party-h2">
            We have a launch
            <br />
            to share.
          </h2>
          <p className="party-sub">Special news — revealed in person only.</p>
        </section>

        <section ref={setSec(5)} className="party-sec party-finale" id="rsvp">
          <div className="party-card">
            <h2 className="party-h2 party-card-title">Come celebrate.</h2>

            {left && (
              <div className="party-count" aria-label="countdown">
                {(
                  [
                    [left.d, 'days'],
                    [left.h, 'hrs'],
                    [left.m, 'min'],
                    [left.s, 'sec']
                  ] as const
                ).map(([v, l]) => (
                  <div key={l} className="party-count-box">
                    <span className="party-count-num">{v}</span>
                    <span className="party-count-lbl">{l}</span>
                  </div>
                ))}
              </div>
            )}

            <dl className="party-details">
              <div>
                <dt>Date</dt>
                <dd>Saturday, 18 July 2026</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>3:00 PM onwards</dd>
              </div>
              <div>
                <dt>Place</dt>
                <dd>
                  1391, 3rd Cross, 9th Main, Judicial Layout, Bengaluru{' '}
                  <a href={MAPS_URL} target="_blank" rel="noreferrer" className="party-link">
                    directions ↗
                  </a>
                </dd>
              </div>
              <div>
                <dt>Mood</dt>
                <dd>Black tie optional. Curiosity mandatory.</dd>
              </div>
            </dl>

            {status === 'done' ? (
              <div className="party-done">
                <p className="party-done-mark">✳</p>
                <p className="party-done-title">You&rsquo;re on the list.</p>
                <p className="party-done-sub">
                  {wasUpdate ? 'We updated your earlier RSVP. ' : ''}
                  We&rsquo;ll ping you the day before. Come hungry, leave indoctrinated.
                </p>
                <div className="party-done-actions">
                  <a href={CAL_URL} target="_blank" rel="noreferrer" className="party-btn party-btn-ghost">
                    Add to calendar
                  </a>
                  <a href={MAPS_URL} target="_blank" rel="noreferrer" className="party-btn party-btn-ghost">
                    Get directions
                  </a>
                </div>
              </div>
            ) : (
              <form className="party-form" onSubmit={submit}>
                <label className="party-field">
                  <span>Your name</span>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="So the door knows you" autoComplete="name" required minLength={2} maxLength={80} />
                </label>
                <label className="party-field">
                  <span>WhatsApp or email</span>
                  <input value={contact} onChange={e => setContact(e.target.value)} placeholder="For the guest list" autoComplete="tel" required maxLength={120} />
                </label>
                <div className="party-field">
                  <span>Bringing anyone?</span>
                  <div className="party-pills">
                    <button type="button" data-on={guests === 1} onClick={() => setGuests(1)}>
                      Just me
                    </button>
                    <button type="button" data-on={guests === 2} onClick={() => setGuests(2)}>
                      Me +1
                    </button>
                  </div>
                </div>
                {error && <p className="party-error">{error}</p>}
                <button type="submit" className="party-btn party-btn-fill" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Saving…' : 'Save my spot'}
                </button>
                <p className="party-fine">The guest list closes when we&rsquo;re full.</p>
              </form>
            )}
          </div>

          <p className="party-footer">
            heyrhai.com · thrown by <span className="party-footer-orange">Rhai</span>, powered by Claude
          </p>
        </section>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles — scoped to the party page; deliberately not the site's light theme.
// ---------------------------------------------------------------------------

const CSS = `
/* The page behind the page — so overscroll/rubber-band and unpainted tiles
   are black, not the site's cream. */
html:has(.party-root) { background: #070605; }
.party-root {
  --serif: var(--font-party-serif, Georgia, 'Times New Roman', serif);
  --mono: var(--font-party-mono, Menlo, monospace);
  --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background: #070605;
  color: ${CREAM};
  min-height: 100vh;
  overflow-x: clip;
}
.party-canvas, .party-fallback { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; }
.party-fallback { background: radial-gradient(ellipse 70% 50% at 50% 38%, rgba(217,119,87,0.16), transparent 70%), #070605; }
.party-veil {
  position: fixed; inset: 0; z-index: 1; pointer-events: none;
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E") repeat,
    radial-gradient(ellipse 120% 90% at 50% 42%, transparent 55%, rgba(0,0,0,0.55) 100%);
  opacity: 0.35;
}
.party-chrome {
  position: fixed; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; justify-content: space-between; align-items: center;
  padding: clamp(18px, 3vw, 30px) clamp(20px, 4vw, 44px);
  mix-blend-mode: screen;
}
.party-mark { display: flex; align-items: baseline; gap: 9px; font-family: var(--serif); font-size: 21px; color: ${CREAM}; }
.party-dot { width: 9px; height: 9px; border-radius: 50%; background: ${ORANGE}; box-shadow: 0 0 14px rgba(217,119,87,0.9); }
.party-meta { font-family: var(--mono); font-size: 11px; letter-spacing: 0.28em; color: ${MUTED}; }

.party-jump {
  position: fixed; right: clamp(16px, 3vw, 32px); bottom: clamp(16px, 3vw, 30px); z-index: 10;
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.22em;
  color: ${ORANGE}; background: rgba(7,6,5,0.55); backdrop-filter: blur(10px);
  border: 1px solid rgba(217,119,87,0.5); border-radius: 999px; padding: 11px 18px;
  cursor: pointer; opacity: 0; transform: translateY(10px); pointer-events: none;
  transition: opacity .45s ease, transform .45s ease, background .2s ease;
}
.party-jump[data-on="true"] { opacity: 1; transform: none; pointer-events: auto; }
.party-jump:hover { background: rgba(217,119,87,0.14); }

.party-main { position: relative; z-index: 5; }
.party-sec {
  min-height: 125vh; display: flex; flex-direction: column; justify-content: center; align-items: center;
  text-align: center; padding: 12vh clamp(20px, 6vw, 60px);
  will-change: opacity, transform;
}
.party-hero { min-height: 100svh; }
.party-finale { min-height: 140vh; justify-content: flex-start; padding-top: 24vh; }
/* Dark scrim behind each copy beat so text stays readable over the particles. */
.party-sec:not(.party-hero):not(.party-finale) {
  background: radial-gradient(ellipse 60% 42% at 50% 50%, rgba(7,6,5,0.88), rgba(7,6,5,0.5) 55%, transparent 78%);
}
.party-hero {
  background: radial-gradient(ellipse 56% 40% at 50% 50%, rgba(7,6,5,0.86), rgba(7,6,5,0.48) 55%, transparent 76%);
}

.party-eyebrow {
  font-family: var(--mono); font-size: clamp(10px, 1.4vw, 12px); letter-spacing: 0.42em;
  text-transform: uppercase; color: ${ORANGE}; margin: 0 0 26px;
}
.party-h1 {
  font-family: var(--serif); font-weight: 550; font-size: clamp(3.4rem, 12vw, 7.5rem);
  line-height: 0.98; letter-spacing: -0.025em; margin: 0; color: ${CREAM};
  text-shadow: 0 0 80px rgba(217,119,87,0.25);
}
.party-h2 {
  font-family: var(--serif); font-weight: 500; font-size: clamp(2.3rem, 7.6vw, 4.7rem);
  line-height: 1.04; letter-spacing: -0.02em; margin: 0; color: ${CREAM};
}
.party-h2 em { font-style: italic; color: ${ORANGE}; }
.party-sub {
  font-family: var(--sans); font-size: clamp(15px, 2.2vw, 18px); line-height: 1.65;
  color: ${MUTED}; max-width: 36ch; margin: 26px 0 0;
}
.party-typed {
  font-family: var(--mono); font-size: clamp(10.5px, 1.6vw, 13px); letter-spacing: 0.06em;
  color: ${MUTED}; margin: 34px 0 0; min-height: 1.4em;
}
.party-caret { display: inline-block; width: 8px; height: 1em; background: ${ORANGE}; margin-left: 3px; vertical-align: text-bottom; animation: party-blink 1.1s steps(1) infinite; }
@keyframes party-blink { 50% { opacity: 0; } }

.party-cue {
  position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  background: none; border: 0; cursor: pointer; padding: 8px 12px;
  animation: party-bob 2.2s ease-in-out infinite;
}
.party-cue-word {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.34em; text-transform: uppercase; color: ${ORANGE};
}
.party-cue-line { width: 1px; height: 40px; background: linear-gradient(${ORANGE}, transparent); animation: party-drop 1.8s ease-in-out infinite; }
.party-cue-chev { font-size: 16px; line-height: 0; color: ${ORANGE}; margin-top: -8px; }
@keyframes party-drop { 0% { transform: scaleY(0); transform-origin: top; } 45% { transform: scaleY(1); transform-origin: top; } 55% { transform: scaleY(1); transform-origin: bottom; } 100% { transform: scaleY(0); transform-origin: bottom; } }
@keyframes party-bob { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, 7px); } }

.party-nudge {
  position: fixed; bottom: clamp(16px, 3vw, 30px); left: 50%; transform: translate(-50%, 12px);
  z-index: 10; display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
  color: ${ORANGE}; background: rgba(7,6,5,0.6); backdrop-filter: blur(10px);
  border: 1px solid rgba(217,119,87,0.5); border-radius: 999px; padding: 11px 18px;
  cursor: pointer; opacity: 0; pointer-events: none;
  transition: opacity .5s ease, transform .5s ease;
}
.party-nudge[data-on="true"] { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; animation: party-bob 2.2s ease-in-out infinite .5s; }
.party-nudge-chev { font-size: 15px; line-height: 0; }

.party-card {
  width: min(660px, 94vw);
  background: rgba(15,13,11,0.72); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(217,119,87,0.3); border-radius: 26px;
  padding: clamp(30px, 5.5vw, 56px);
  box-shadow: 0 40px 140px rgba(0,0,0,0.65), inset 0 1px 0 rgba(244,239,230,0.07);
  text-align: left;
}
.party-card-title { text-align: center; font-size: clamp(2.2rem, 6.5vw, 3.6rem); }

.party-count { display: flex; gap: 10px; justify-content: center; margin: 30px 0 6px; }
.party-count-box {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  border: 1px solid rgba(244,239,230,0.13); border-radius: 14px; padding: 12px 0 9px; width: 72px;
  background: rgba(244,239,230,0.03);
}
.party-count-num { font-family: var(--mono); font-size: 26px; color: ${CREAM}; font-variant-numeric: tabular-nums; }
.party-count-lbl { font-family: var(--mono); font-size: 9px; letter-spacing: 0.3em; text-transform: uppercase; color: ${MUTED}; }

.party-details { margin: 30px 0 0; display: grid; gap: 0; }
.party-details > div {
  display: grid; grid-template-columns: 84px 1fr; gap: 16px; align-items: baseline;
  padding: 15px 2px; border-top: 1px solid rgba(244,239,230,0.09);
}
.party-details dt { font-family: var(--mono); font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: ${MUTED}; }
.party-details dd { margin: 0; font-family: var(--sans); font-size: 15.5px; line-height: 1.55; color: ${CREAM}; }
.party-link { color: ${ORANGE}; text-decoration: none; font-size: 13.5px; white-space: nowrap; }
.party-link:hover { text-decoration: underline; }

.party-form { margin-top: 34px; display: grid; gap: 18px; }
.party-field { display: grid; gap: 8px; }
.party-field > span { font-family: var(--mono); font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: ${MUTED}; }
.party-field input {
  font-family: var(--sans); font-size: 16px; color: ${CREAM};
  background: rgba(244,239,230,0.055); border: 1px solid rgba(244,239,230,0.16); border-radius: 13px;
  padding: 14px 16px; outline: none; width: 100%;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.party-field input::placeholder { color: rgba(176,166,149,0.55); }
.party-field input:focus { border-color: rgba(217,119,87,0.75); box-shadow: 0 0 0 3px rgba(217,119,87,0.14); }
.party-pills { display: flex; gap: 10px; }
.party-pills button {
  flex: 1; font-family: var(--sans); font-size: 14.5px; color: ${MUTED}; cursor: pointer;
  background: rgba(244,239,230,0.045); border: 1px solid rgba(244,239,230,0.14); border-radius: 13px; padding: 13px 0;
  transition: all .18s ease;
}
.party-pills button[data-on="true"] { color: ${CREAM}; border-color: rgba(217,119,87,0.8); background: rgba(217,119,87,0.13); }
.party-error { font-family: var(--sans); font-size: 13.5px; color: #e8907a; margin: -4px 0 0; }
.party-btn {
  display: inline-flex; justify-content: center; align-items: center;
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.28em; text-transform: uppercase;
  border-radius: 13px; padding: 17px 22px; cursor: pointer; text-decoration: none;
  transition: all .2s ease; border: 1px solid transparent;
}
.party-btn-fill { background: ${ORANGE}; color: #17100c; font-weight: 600; }
.party-btn-fill:hover { background: #e08a6c; box-shadow: 0 6px 34px rgba(217,119,87,0.35); }
.party-btn-fill:disabled { opacity: 0.55; cursor: default; }
.party-btn-ghost { border-color: rgba(217,119,87,0.5); color: ${ORANGE}; flex: 1; }
.party-btn-ghost:hover { background: rgba(217,119,87,0.12); }
.party-fine { font-family: var(--mono); font-size: 10px; letter-spacing: 0.18em; color: ${MUTED}; text-align: center; margin: 2px 0 0; }

.party-done { text-align: center; padding: 26px 0 6px; }
.party-done-mark { font-size: 42px; color: ${ORANGE}; margin: 0; text-shadow: 0 0 30px rgba(217,119,87,0.7); }
.party-done-title { font-family: var(--serif); font-size: clamp(1.9rem, 5vw, 2.6rem); color: ${CREAM}; margin: 14px 0 0; }
.party-done-sub { font-family: var(--sans); font-size: 15px; line-height: 1.6; color: ${MUTED}; max-width: 38ch; margin: 14px auto 0; }
.party-done-actions { display: flex; gap: 12px; margin-top: 28px; }

.party-footer { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.22em; color: ${MUTED}; margin: 60px 0 40px; text-transform: uppercase; }
.party-footer-orange { color: ${ORANGE}; }

@media (max-width: 560px) {
  .party-details > div { grid-template-columns: 1fr; gap: 5px; padding: 13px 2px; }
  .party-done-actions { flex-direction: column; }
  .party-count-box { width: 62px; }
}
`;
