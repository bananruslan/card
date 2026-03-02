import gsap from "gsap";

// ── Path builder ────────────────────────────────────────────────────────
function rrPath(x, y, w, h, r) {
  return `M${x+r},${y} L${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r}
          L${x+w},${y+h-r} Q${x+w},${y+h} ${x+w-r},${y+h}
          L${x+r},${y+h} Q${x},${y+h} ${x},${y+h-r}
          L${x},${y+r} Q${x},${y} ${x+r},${y} Z`;
}

const PADS = [20];
const RADII = [36];

function buildPaths() {
  const W = window.innerWidth, H = window.innerHeight;
  ['path-outer'].forEach((id, i) => {
    const p = PADS[i];
    document.getElementById(id).setAttribute('d',
      rrPath(p, p, W - p*2, H - p*2, RADII[i]));
  });

}

buildPaths();
window.addEventListener('resize', buildPaths);

// ── Animation state ─────────────────────────────────────────────────────
let speed = 1, dir = 1;
let o1 = 0;

function getPt(pathId, frac) {
  const el = document.getElementById(pathId);
  const len = el.getTotalLength();
  return el.getPointAtLength(((frac % 1) + 1) % 1 * len);
}

gsap.ticker.add(() => {
  const s = speed * dir;

  // Text offsets
  o1 = ((o1 + s * 0.016) % 100 + 100) % 100;

  document.getElementById('tp-outer').setAttribute('startOffset', o1 + '%');
});

// ── Entrance ──────────────────────────────────────────────────────────
gsap.from('#border-svg', { opacity: 0, duration: 2, ease: 'expo.out' });
