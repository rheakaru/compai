'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/* Level definitions — add new cities here to create more levels.      */
/* Grid legend: # wall · . path · S start · G gate · m marigold · b bell */
/* ------------------------------------------------------------------ */

type Patrol = { from: [number, number]; to: [number, number] };

export type LevelDef = {
  id: number;
  city: string;
  title: string;
  subtitle: string;
  story: string[];
  missions: { garlands: number; bell: boolean };
  facts: string[];
  timeLimit: number; // seconds
  grid: string[];
  monkeys: Patrol[];
  locked?: boolean;
};

const LEVELS: LevelDef[] = [
  {
    id: 1,
    city: 'Vijayawada',
    title: 'The Hill of Victory',
    subtitle: 'Indrakeeladri Hill · Andhra Pradesh',
    story: [
      'Drew has arrived in Vijayawada, the bustling city on the banks of the mighty Krishna River in Andhra Pradesh.',
      'Long ago, the goddess Kanaka Durga defeated the demon Mahishasura here and made her home on Indrakeeladri Hill. The Pandava hero Arjuna also meditated on this hill to win Lord Shiva’s blessing — and his victory ("vijaya") gave the city its name: Vijayawada, the Place of Victory!',
      'Tonight is the temple festival. Help Drew climb the hill’s winding stone maze: gather marigold garlands for the puja, find the sacred temple bell, and reach the golden gate of the Kanaka Durga Temple before the evening aarti begins. Watch out for the mischievous temple monkeys!',
    ],
    missions: { garlands: 6, bell: true },
    facts: [
      'Vijayawada sits on the Krishna River, one of India’s longest rivers. The famous Prakasam Barrage stretches over 1 km across it.',
      'The Kanaka Durga Temple on Indrakeeladri Hill draws lakhs of pilgrims every Dasara festival.',
      'The Undavalli Caves nearby were carved out of solid sandstone rock over 1,500 years ago!',
    ],
    timeLimit: 180,
    grid: [
      '#####################',
      '#..m....#.......#..G#',
      '#.#####.#.#####.#.#.#',
      '#.#...#.#...#.m.#.#.#',
      '#.#.#.#.###.#.###.#.#',
      '#...#.....#.#.....#.#',
      '#####.###.#.#####.#.#',
      '#...#.#m..#.....#...#',
      '#.#.#.#.#######.###.#',
      '#.#...#....m..#...#.#',
      '#.#########.#.###.#.#',
      '#.#....b..#.#.#.m.#.#',
      '#.#.####.##.#.#.###.#',
      '#S...#..m...#.......#',
      '#####################',
    ],
    monkeys: [
      { from: [5, 5], to: [9, 5] },
      { from: [7, 9], to: [13, 9] },
      { from: [13, 13], to: [19, 13] },
    ],
  },
  {
    id: 2,
    city: 'Hampi',
    title: 'The Stone Chariot',
    subtitle: 'Ruins of Vijayanagara · Karnataka',
    story: [],
    missions: { garlands: 8, bell: true },
    facts: [],
    timeLimit: 180,
    grid: [],
    monkeys: [],
    locked: true,
  },
  {
    id: 3,
    city: 'Madurai',
    title: 'The Thousand-Pillar Hall',
    subtitle: 'Meenakshi Temple · Tamil Nadu',
    story: [],
    missions: { garlands: 10, bell: true },
    facts: [],
    timeLimit: 180,
    grid: [],
    monkeys: [],
    locked: true,
  },
];

/* ------------------------------------------------------------------ */
/* Pixel-art sprites (Mario-style, drawn in code — no image assets).   */
/* ------------------------------------------------------------------ */

const PAL: Record<string, string> = {
  r: '#e0342b', R: '#a31f18', // cap red
  s: '#f2c088', S: '#d99a5b', // skin
  h: '#3a2417', // hair
  b: '#2b5fd9', B: '#1c3f96', // kurta blue
  y: '#ffcf3f', Y: '#d99e14', // gold / bell
  w: '#ffffff', k: '#1a1a1a',
  o: '#ff8c1a', O: '#d96a00', // marigold orange
  g: '#2e8b3d', G: '#1d5c28', // leaf green
  m: '#8a5a33', M: '#5f3c1e', // monkey brown
  t: '#e8c39a', // monkey face tan
  p: '#ff5db1', // pink
};

const DREW = [
  '....rrrr....',
  '..rrrrrrrr..',
  '.rrrrrrrrrr.',
  '.RRRRRRRRRR.',
  '.hssssssssh.',
  '.hsksskssoh.',
  '..ssssssss..',
  '..sSskkSss..',
  '...bbbbbb...',
  '..bbbBBbbb..',
  '.sbbbbbbbbs.',
  '.sbbbBBbbbs.',
  '..BBB..BBB..',
  '..SS....SS..',
];

const MONKEY = [
  '..mm....mm..',
  '.mmmm..mmmm.',
  '.mmmmmmmmmm.',
  '..mttttttm..',
  '..tkttttkt..',
  '..tttkkttt..',
  '...tttttt...',
  '..mmmmmmmm..',
  '.mmtttttmm..',
  '.mmtttttmmM.',
  '..mmmmmmmM..',
  '..MM..MM.M..',
];

const MARIGOLD = [
  '..oo..oo..',
  '.oOooooOo.',
  '.ooOyyOoo.',
  '..oyyyyo..',
  '..oyyyyo..',
  '.ooOyyOoo.',
  '.oOooooOo.',
  '..oo..oo..',
  '....gg....',
  '...g..g...',
];

const BELL = [
  '....yy....',
  '...yYYy...',
  '..yyyyyy..',
  '..yyyyyy..',
  '.yyyyyyyy.',
  '.yYyyyyYy.',
  'yyyyyyyyyy',
  'YYYYYYYYYY',
  '....kk....',
  '...kYYk...',
];

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  x: number,
  y: number,
  px: number
) {
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const c = sprite[row][col];
      if (c === '.') continue;
      ctx.fillStyle = PAL[c] ?? '#000';
      ctx.fillRect(x + col * px, y + row * px, px, px);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Game constants                                                      */
/* ------------------------------------------------------------------ */

const TILE = 32;
const PLAYER_SPEED = 128; // px/sec
const MONKEY_SPEED = 62; // px/sec
const HITBOX = 20;

type Item = { col: number; row: number; kind: 'm' | 'b'; taken: boolean };
type Monkey = { x: number; y: number; from: [number, number]; to: [number, number]; dir: 1 | -1 };

type Screen = 'select' | 'story' | 'playing' | 'won' | 'gameover';

type World = {
  level: LevelDef;
  cols: number;
  rows: number;
  walls: boolean[][];
  items: Item[];
  start: [number, number];
  gate: [number, number];
  px: number; // player position (top-left of hitbox reference = center-based below)
  py: number;
  monkeys: Monkey[];
  timeLeft: number;
  invulnUntil: number;
  won: boolean;
};

function buildWorld(level: LevelDef): World {
  const rows = level.grid.length;
  const cols = level.grid[0].length;
  const walls: boolean[][] = [];
  const items: Item[] = [];
  let start: [number, number] = [1, 1];
  let gate: [number, number] = [cols - 2, 1];
  for (let r = 0; r < rows; r++) {
    walls.push([]);
    for (let c = 0; c < cols; c++) {
      const ch = level.grid[r][c];
      walls[r].push(ch === '#');
      if (ch === 'S') start = [c, r];
      if (ch === 'G') gate = [c, r];
      if (ch === 'm') items.push({ col: c, row: r, kind: 'm', taken: false });
      if (ch === 'b') items.push({ col: c, row: r, kind: 'b', taken: false });
    }
  }
  return {
    level,
    cols,
    rows,
    walls,
    items,
    start,
    gate,
    px: start[0] * TILE + TILE / 2,
    py: start[1] * TILE + TILE / 2,
    monkeys: level.monkeys.map((p) => ({
      x: p.from[0] * TILE + TILE / 2,
      y: p.from[1] * TILE + TILE / 2,
      from: p.from,
      to: p.to,
      dir: 1,
    })),
    timeLeft: level.timeLimit,
    invulnUntil: 0,
    won: false,
  };
}

/* Tiny retro sound effects via WebAudio — no files needed. */
function useBeeps() {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback((kind: 'pickup' | 'bell' | 'hurt' | 'win' | 'lose') => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = ctxRef.current;
      const notes: Record<string, [number, number][]> = {
        pickup: [[880, 0.07], [1320, 0.09]],
        bell: [[1568, 0.25], [1175, 0.3]],
        hurt: [[220, 0.12], [147, 0.18]],
        win: [[659, 0.12], [784, 0.12], [988, 0.12], [1319, 0.3]],
        lose: [[392, 0.2], [330, 0.2], [262, 0.35]],
      };
      let t = ctx.currentTime;
      for (const [freq, dur] of notes[kind]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === 'bell' ? 'triangle' : 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
        t += dur * 0.8;
      }
    } catch {
      /* audio blocked — fine */
    }
  }, []);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function LabyrinthGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const facingRef = useRef<1 | -1>(1);

  const [screen, setScreen] = useState<Screen>('select');
  const [levelIdx, setLevelIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [garlands, setGarlands] = useState(0);
  const [bellFound, setBellFound] = useState(false);
  const [toast, setToast] = useState('');
  const [gameoverReason, setGameoverReason] = useState('');
  const beep = useBeeps();

  const level = LEVELS[levelIdx];
  const missionsDone =
    garlands >= level.missions.garlands && (!level.missions.bell || bellFound);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const startLevel = useCallback(
    (idx: number, keepLives?: number) => {
      const w = buildWorld(LEVELS[idx]);
      worldRef.current = w;
      setLevelIdx(idx);
      setLives(keepLives ?? 3);
      setTimeLeft(w.timeLeft);
      setGarlands(0);
      setBellFound(false);
      setToast('');
      setScreen('playing');
      lastRef.current = 0;
    },
    []
  );

  /* Keyboard input */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysRef.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  /* Main game loop */
  useEffect(() => {
    if (screen !== 'playing') return;
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const isWall = (c: number, r: number) =>
      c < 0 || r < 0 || c >= world.cols || r >= world.rows || world.walls[r][c];

    const collides = (x: number, y: number) => {
      const half = HITBOX / 2;
      const corners: [number, number][] = [
        [x - half, y - half],
        [x + half, y - half],
        [x - half, y + half],
        [x + half, y + half],
      ];
      return corners.some(([cx, cy]) =>
        isWall(Math.floor(cx / TILE), Math.floor(cy / TILE))
      );
    };

    let missionsDoneLocal =
      world.items.filter((i) => i.kind === 'm' && i.taken).length >=
        world.level.missions.garlands &&
      (!world.level.missions.bell || world.items.some((i) => i.kind === 'b' && i.taken));
    let gateHintShown = false;

    const loseLife = (reason: 'monkey' | 'time') => {
      beep('hurt');
      setLives((l) => {
        const next = l - 1;
        if (next <= 0) {
          beep('lose');
          setGameoverReason(
            reason === 'time'
              ? 'The evening aarti began without Drew… time ran out!'
              : 'The temple monkeys were too mischievous this time!'
          );
          setScreen('gameover');
        } else {
          showToast(
            reason === 'time'
              ? `⏱️ Time up! Drew hurries back — ${next} ${next === 1 ? 'life' : 'lives'} left`
              : `🐒 A monkey snatched at Drew! ${next} ${next === 1 ? 'life' : 'lives'} left`
          );
        }
        return next;
      });
      world.px = world.start[0] * TILE + TILE / 2;
      world.py = world.start[1] * TILE + TILE / 2;
      world.invulnUntil = performance.now() + 2200;
      if (reason === 'time') {
        world.timeLeft = world.level.timeLimit;
        setTimeLeft(world.level.timeLimit);
      }
    };

    const step = (now: number) => {
      if (!lastRef.current) lastRef.current = now;
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;

      /* --- timer --- */
      const prevT = Math.ceil(world.timeLeft);
      world.timeLeft -= dt;
      const curT = Math.ceil(world.timeLeft);
      if (curT !== prevT) setTimeLeft(Math.max(0, curT));
      if (world.timeLeft <= 0) {
        loseLife('time');
        if (worldRef.current !== world) return;
      }

      /* --- player movement --- */
      const k = keysRef.current;
      let dx = 0;
      let dy = 0;
      if (k['arrowleft'] || k['a']) dx -= 1;
      if (k['arrowright'] || k['d']) dx += 1;
      if (k['arrowup'] || k['w']) dy -= 1;
      if (k['arrowdown'] || k['s']) dy += 1;
      if (dx !== 0) facingRef.current = dx > 0 ? 1 : -1;
      if (dx && dy) {
        dx *= 0.7071;
        dy *= 0.7071;
      }
      const nx = world.px + dx * PLAYER_SPEED * dt;
      const ny = world.py + dy * PLAYER_SPEED * dt;
      if (!collides(nx, world.py)) world.px = nx;
      if (!collides(world.px, ny)) world.py = ny;

      /* --- monkeys patrol --- */
      for (const mk of world.monkeys) {
        const [fx] = [mk.from[0] * TILE + TILE / 2];
        const tx = mk.to[0] * TILE + TILE / 2;
        const fy = mk.from[1] * TILE + TILE / 2;
        const ty = mk.to[1] * TILE + TILE / 2;
        if (mk.from[1] === mk.to[1]) {
          mk.x += mk.dir * MONKEY_SPEED * dt;
          if (mk.x > Math.max(fx, tx)) mk.dir = -1;
          if (mk.x < Math.min(fx, tx)) mk.dir = 1;
        } else {
          mk.y += mk.dir * MONKEY_SPEED * dt;
          if (mk.y > Math.max(fy, ty)) mk.dir = -1;
          if (mk.y < Math.min(fy, ty)) mk.dir = 1;
        }
      }

      /* --- pickups --- */
      for (const item of world.items) {
        if (item.taken) continue;
        const ix = item.col * TILE + TILE / 2;
        const iy = item.row * TILE + TILE / 2;
        if (Math.hypot(world.px - ix, world.py - iy) < 20) {
          item.taken = true;
          if (item.kind === 'm') {
            beep('pickup');
            const count = world.items.filter((i) => i.kind === 'm' && i.taken).length;
            setGarlands(count);
            showToast(
              count >= world.level.missions.garlands
                ? '🌼 All garlands gathered for the puja!'
                : `🌼 Marigold garland! ${count}/${world.level.missions.garlands}`
            );
          } else {
            beep('bell');
            setBellFound(true);
            showToast('🔔 The sacred temple bell! Its sound fills the hill…');
          }
          missionsDoneLocal =
            world.items.filter((i) => i.kind === 'm' && i.taken).length >=
              world.level.missions.garlands &&
            (!world.level.missions.bell ||
              world.items.some((i) => i.kind === 'b' && i.taken));
          if (missionsDoneLocal) {
            setTimeout(
              () => showToast('✨ The temple gate is glowing — head to the top right!'),
              1200
            );
          }
        }
      }

      /* --- monkey collision --- */
      if (now > world.invulnUntil) {
        for (const mk of world.monkeys) {
          if (Math.hypot(world.px - mk.x, world.py - mk.y) < 22) {
            loseLife('monkey');
            break;
          }
        }
      }

      /* --- gate --- */
      {
        const gx = world.gate[0] * TILE + TILE / 2;
        const gy = world.gate[1] * TILE + TILE / 2;
        if (Math.hypot(world.px - gx, world.py - gy) < 24) {
          if (missionsDoneLocal && !world.won) {
            world.won = true;
            beep('win');
            setScreen('won');
            return;
          }
          if (!missionsDoneLocal && !gateHintShown) {
            gateHintShown = true;
            showToast('🚪 The gate is closed — finish the missions first!');
            setTimeout(() => (gateHintShown = false), 4000);
          }
        }
      }

      render(now);
      rafRef.current = requestAnimationFrame(step);
    };

    const render = (now: number) => {
      const W = world.cols * TILE;
      const H = world.rows * TILE;

      /* evening-sky gradient behind everything */
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#2d1b4e');
      sky.addColorStop(0.5, '#7a3b6d');
      sky.addColorStop(1, '#e8804d');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      /* tiles */
      for (let r = 0; r < world.rows; r++) {
        for (let c = 0; c < world.cols; c++) {
          const x = c * TILE;
          const y = r * TILE;
          if (world.walls[r][c]) {
            /* sandstone brick wall, Mario-brick style */
            ctx.fillStyle = '#b0562a';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = '#c96a38';
            ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
            ctx.fillStyle = '#8a3f1d';
            ctx.fillRect(x, y + 15, TILE, 2);
            const off = r % 2 === 0 ? 8 : 20;
            ctx.fillRect(x + off, y, 2, 16);
            ctx.fillRect(x + ((off + 12) % 28) + 2, y + 17, 2, 15);
            ctx.fillStyle = '#e08a52';
            ctx.fillRect(x + 2, y + 2, TILE - 4, 2);
          } else {
            /* sandy hill path */
            ctx.fillStyle = '#e9d29b';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = '#dcc286';
            if ((r * 7 + c * 13) % 5 === 0) ctx.fillRect(x + 6, y + 10, 3, 3);
            if ((r * 11 + c * 3) % 7 === 0) ctx.fillRect(x + 22, y + 20, 3, 3);
            if ((r * 5 + c * 17) % 6 === 0) ctx.fillRect(x + 14, y + 26, 2, 2);
          }
        }
      }

      /* the temple gate (gopuram) */
      {
        const gx = world.gate[0] * TILE;
        const gy = world.gate[1] * TILE;
        const glow = missionsDoneLocal;
        if (glow) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 250);
          ctx.fillStyle = `rgba(255, 214, 90, ${0.25 + pulse * 0.3})`;
          ctx.beginPath();
          ctx.arc(gx + TILE / 2, gy + TILE / 2, 30 + pulse * 8, 0, Math.PI * 2);
          ctx.fill();
        }
        /* tiered tower rising above the maze wall */
        const tiers: [number, number, string][] = [
          [gx - 4, gy - 26, '#d94f30'],
          [gx - 1, gy - 18, '#e8783a'],
          [gx + 2, gy - 10, '#d94f30'],
        ];
        for (const [tx, ty, color] of tiers) {
          ctx.fillStyle = color;
          ctx.fillRect(tx, ty, TILE - 2 * (tx - gx), 9);
          ctx.fillStyle = '#ffd65a';
          ctx.fillRect(tx + 3, ty + 3, 4, 3);
          ctx.fillRect(tx + (TILE - 2 * (tx - gx)) - 7, ty + 3, 4, 3);
        }
        ctx.fillStyle = '#ffd65a';
        ctx.fillRect(gx + 12, gy - 32, 8, 7); // golden kalasham on top
        /* gate body */
        ctx.fillStyle = glow ? '#ffd65a' : '#7a4a22';
        ctx.fillRect(gx + 2, gy + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = glow ? '#fff3c4' : '#5d3517';
        ctx.fillRect(gx + 8, gy + 8, TILE - 16, TILE - 10);
        if (!glow) {
          ctx.fillStyle = '#3d2410';
          for (let i = 0; i < 3; i++) ctx.fillRect(gx + 9 + i * 6, gy + 8, 2, TILE - 10);
        }
      }

      /* items */
      for (const item of world.items) {
        if (item.taken) continue;
        const bob = Math.sin(now / 300 + item.col * 2) * 2;
        const x = item.col * TILE + 6;
        const y = item.row * TILE + 6 + bob;
        drawSprite(ctx, item.kind === 'm' ? MARIGOLD : BELL, x, y, 2);
      }

      /* monkeys */
      for (const mk of world.monkeys) {
        const hop = Math.abs(Math.sin(now / 180 + mk.x)) * 3;
        drawSprite(ctx, MONKEY, mk.x - 12, mk.y - 12 - hop, 2);
      }

      /* Drew */
      {
        const flashing = now < world.invulnUntil && Math.floor(now / 120) % 2 === 0;
        if (!flashing) {
          const walking =
            keysRef.current['arrowleft'] || keysRef.current['arrowright'] ||
            keysRef.current['arrowup'] || keysRef.current['arrowdown'] ||
            keysRef.current['a'] || keysRef.current['d'] ||
            keysRef.current['w'] || keysRef.current['s'];
          const bounce = walking ? Math.abs(Math.sin(now / 100)) * 2 : 0;
          ctx.save();
          if (facingRef.current === -1) {
            ctx.translate(world.px * 2, 0);
            ctx.scale(-1, 1);
          }
          drawSprite(ctx, DREW, world.px - 12, world.py - 15 - bounce, 2);
          ctx.restore();
        }
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, beep, showToast]);

  /* Touch d-pad helpers */
  const pressKey = (key: string, down: boolean) => {
    keysRef.current[key] = down;
  };
  const dpadBtn = (key: string, label: string, area: string) => (
    <button
      key={key}
      aria-label={key}
      style={{ gridArea: area }}
      className="flex h-14 w-14 select-none items-center justify-center rounded-xl bg-amber-900/80 text-2xl text-amber-100 shadow-lg active:bg-amber-700"
      onPointerDown={(e) => {
        e.preventDefault();
        pressKey(key, true);
      }}
      onPointerUp={() => pressKey(key, false)}
      onPointerLeave={() => pressKey(key, false)}
    >
      {label}
    </button>
  );

  const mins = Math.floor(Math.max(0, timeLeft) / 60);
  const secs = Math.max(0, timeLeft) % 60;

  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0f2e] via-[#3d1f4d] to-[#7a3b3b] py-8 text-amber-50">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4">
        <header className="text-center">
          <h1 className="text-3xl font-black tracking-wide text-amber-300 drop-shadow-[2px_2px_0_#7a3b1d] sm:text-4xl">
            🏮 Drew&apos;s Labyrinth of India
          </h1>
          <p className="mt-1 text-sm text-amber-200/80">
            Explore real Indian cities, one maze at a time
          </p>
        </header>

        {/* ---------------- LEVEL SELECT ---------------- */}
        {screen === 'select' && (
          <div className="w-full max-w-lg space-y-3">
            {LEVELS.map((lv, i) => (
              <button
                key={lv.id}
                disabled={lv.locked}
                onClick={() => {
                  setLevelIdx(i);
                  setScreen('story');
                }}
                className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
                  lv.locked
                    ? 'cursor-not-allowed border-white/10 bg-white/5 opacity-50'
                    : 'border-amber-400/60 bg-amber-900/40 hover:scale-[1.02] hover:bg-amber-800/50'
                }`}
              >
                <div className="text-3xl">{lv.locked ? '🔒' : '🛕'}</div>
                <div>
                  <div className="font-bold text-amber-200">
                    Level {lv.id}: {lv.city} — {lv.title}
                  </div>
                  <div className="text-sm text-amber-100/70">
                    {lv.locked ? 'Coming soon on Drew’s journey!' : lv.subtitle}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ---------------- STORY INTRO ---------------- */}
        {screen === 'story' && (
          <div className="w-full max-w-2xl rounded-2xl border-2 border-amber-400/60 bg-[#2a1638]/90 p-6 shadow-2xl">
            <h2 className="text-2xl font-black text-amber-300">
              Level {level.id}: {level.city}
            </h2>
            <p className="text-sm font-semibold text-amber-200/70">{level.subtitle}</p>
            <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-amber-50/90">
              {level.story.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-amber-950/60 p-4 text-sm">
              <div className="mb-2 font-bold text-amber-300">🎯 Missions</div>
              <ul className="space-y-1 text-amber-100/90">
                <li>🌼 Collect {level.missions.garlands} marigold garlands</li>
                {level.missions.bell && <li>🔔 Find the sacred temple bell</li>}
                <li>🛕 Reach the glowing temple gate before time runs out</li>
              </ul>
              <div className="mt-3 text-amber-200/70">
                ⏱️ {Math.floor(level.timeLimit / 60)}:
                {String(level.timeLimit % 60).padStart(2, '0')} on the clock · ❤️ 3 lives ·
                move with arrow keys / WASD
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => startLevel(levelIdx)}
                className="rounded-xl bg-amber-400 px-6 py-3 font-black text-amber-950 shadow-lg transition hover:scale-105 hover:bg-amber-300"
              >
                ▶ Start the climb!
              </button>
              <button
                onClick={() => setScreen('select')}
                className="rounded-xl border border-amber-400/40 px-5 py-3 text-amber-200 hover:bg-white/5"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* ---------------- PLAYING ---------------- */}
        {screen === 'playing' && (
          <div className="flex w-full flex-col items-center gap-3">
            {/* HUD */}
            <div className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 rounded-xl bg-black/40 px-4 py-2 text-sm font-bold">
              <span className="text-lg tracking-widest">
                {'❤️'.repeat(Math.max(0, lives))}
                {'🖤'.repeat(Math.max(0, 3 - lives))}
              </span>
              <span
                className={`rounded-lg px-3 py-1 font-mono text-lg ${
                  timeLeft <= 30 ? 'animate-pulse bg-red-600/80' : 'bg-white/10'
                }`}
              >
                ⏱️ {mins}:{String(secs).padStart(2, '0')}
              </span>
              <span>
                🌼 {garlands}/{level.missions.garlands}
              </span>
              <span className={bellFound ? '' : 'opacity-40 grayscale'}>🔔</span>
              <span
                className={`rounded-lg px-2 py-1 ${
                  missionsDone ? 'bg-amber-400 text-amber-950' : 'bg-white/10 text-amber-100/60'
                }`}
              >
                🛕 {missionsDone ? 'Gate open!' : 'Gate locked'}
              </span>
            </div>

            <div className="relative w-full max-w-2xl">
              <canvas
                ref={canvasRef}
                width={level.grid[0].length * TILE}
                height={level.grid.length * TILE}
                className="w-full rounded-xl border-4 border-amber-900 shadow-2xl [image-rendering:pixelated]"
              />
              {toast && (
                <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-xl bg-black/80 px-4 py-2 text-sm font-bold text-amber-200 shadow-xl">
                  {toast}
                </div>
              )}
            </div>

            {/* Touch d-pad (mobile) */}
            <div
              className="grid gap-1 sm:hidden"
              style={{ gridTemplateAreas: `'. up .' 'left . right' '. down .'` }}
            >
              {dpadBtn('arrowup', '▲', 'up')}
              {dpadBtn('arrowleft', '◀', 'left')}
              {dpadBtn('arrowright', '▶', 'right')}
              {dpadBtn('arrowdown', '▼', 'down')}
            </div>

            <button
              onClick={() => setScreen('select')}
              className="text-xs text-amber-200/50 underline hover:text-amber-200"
            >
              Quit to level select
            </button>
          </div>
        )}

        {/* ---------------- WON ---------------- */}
        {screen === 'won' && (
          <div className="w-full max-w-2xl rounded-2xl border-2 border-amber-400 bg-[#2a1638]/90 p-6 text-center shadow-2xl">
            <div className="text-5xl">🎉🛕🎉</div>
            <h2 className="mt-2 text-3xl font-black text-amber-300">Level Complete!</h2>
            <p className="mt-2 text-amber-100/90">
              Drew reached the Kanaka Durga Temple just as the aarti lamps were lit! The
              priests thanked Drew for the marigold garlands and rang the sacred bell over
              the city of victory.
            </p>
            <p className="mt-2 font-mono text-amber-200">
              ⏱️ Finished with {mins}:{String(secs).padStart(2, '0')} to spare · ❤️ ×{lives}
            </p>
            <div className="mt-5 rounded-xl bg-amber-950/60 p-4 text-left text-sm">
              <div className="mb-2 font-bold text-amber-300">
                📚 Did you know? (about {level.city})
              </div>
              <ul className="list-disc space-y-2 pl-5 text-amber-100/90">
                {level.facts.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {LEVELS[levelIdx + 1] && (
                <button
                  disabled={LEVELS[levelIdx + 1].locked}
                  className="rounded-xl bg-amber-400 px-6 py-3 font-black text-amber-950 shadow-lg transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  🔒 Level {LEVELS[levelIdx + 1].id}: {LEVELS[levelIdx + 1].city} — coming
                  soon!
                </button>
              )}
              <button
                onClick={() => startLevel(levelIdx)}
                className="rounded-xl border border-amber-400/60 px-5 py-3 font-bold text-amber-200 hover:bg-white/5"
              >
                ↻ Play again
              </button>
              <button
                onClick={() => setScreen('select')}
                className="rounded-xl border border-amber-400/40 px-5 py-3 text-amber-200 hover:bg-white/5"
              >
                Level select
              </button>
            </div>
          </div>
        )}

        {/* ---------------- GAME OVER ---------------- */}
        {screen === 'gameover' && (
          <div className="w-full max-w-xl rounded-2xl border-2 border-red-500/60 bg-[#2a1020]/90 p-6 text-center shadow-2xl">
            <div className="text-5xl">💔</div>
            <h2 className="mt-2 text-3xl font-black text-red-400">Game Over</h2>
            <p className="mt-2 text-amber-100/80">{gameoverReason}</p>
            <p className="mt-1 text-sm text-amber-100/60">
              But every explorer gets another chance on Indrakeeladri Hill…
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => startLevel(levelIdx)}
                className="rounded-xl bg-amber-400 px-6 py-3 font-black text-amber-950 shadow-lg transition hover:scale-105"
              >
                ↻ Try again
              </button>
              <button
                onClick={() => setScreen('select')}
                className="rounded-xl border border-amber-400/40 px-5 py-3 text-amber-200 hover:bg-white/5"
              >
                Level select
              </button>
            </div>
          </div>
        )}

        <footer className="mt-2 text-center text-xs text-amber-200/40">
          A geography adventure — Level 1 of Drew&apos;s journey across India 🇮🇳
        </footer>
      </div>
    </div>
  );
}
