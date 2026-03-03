import gsap from "gsap";

// ── Path builder ────────────────────────────────────────────────────────
function rrPath(x: number, y: number, width: number, height: number, radius: number) {
  return `
    M${x + radius},${y}

    L${x + width - radius},${y}
    Q${x + width},${y} ${x + width},${y + radius}

    L${x + width},${y + height - radius}
    Q${x + width},${y + height} ${x + width - radius},${y + height}

    L${x + radius},${y + height}
    Q${x},${y + height} ${x},${y + height - radius}

    L${x},${y + radius}
    Q${x},${y} ${x + radius},${y}

    Z`;
}


function buildPaths() {
  const path = document.getElementById('path-outer');

  const width = window.innerWidth;
  const height = window.innerHeight;
  const padding = 20;
  const radius = 36;


  if (path) {
    path.setAttribute('d', rrPath(
      padding,
      padding,
      width - padding * 2,
      height - padding * 2,
      radius
    ));
  }
}

buildPaths();
window.addEventListener('resize', buildPaths);

// ── Animation state ─────────────────────────────────────────────────────
const speed = 1;
const direction = 1;
let offset = 0;

gsap.ticker.add(() => {
  const textPath = document.getElementById('tp-outer');
  offset = ((offset + speed * direction * 0.016) % 100);

  if (textPath) {
    textPath.setAttribute('startOffset', offset + '%');
  }
});

// ── Entrance ──────────────────────────────────────────────────────────
gsap.from('#border-svg', { opacity: 0, duration: 2, ease: 'expo.out' });
