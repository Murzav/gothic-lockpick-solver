// Verifies the active-pin salience colours meet WCAG contrast, using the same
// OKLCH -> linear sRGB -> relative luminance method documented in src/app.css.
// Run: bun scripts/check-contrast.ts

interface Oklch {
  L: number;
  C: number;
  h: number;
}

function oklchToLinearSrgb({ L, C, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function luminance(c: Oklch): number {
  const [r, g, b] = oklchToLinearSrgb(c).map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: Oklch, b: Oklch): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// color-mix in oklch: aWeight of `a` plus (1 - aWeight) of `b`. Both tokens
// here share hue ~55, so linear hue interpolation is exact.
function mixOklch(a: Oklch, b: Oklch, aWeight: number): Oklch {
  const w = aWeight;
  return {
    L: a.L * w + b.L * (1 - w),
    C: a.C * w + b.C * (1 - w),
    h: a.h * w + b.h * (1 - w),
  };
}

// Tokens copied from src/app.css.
const bg: Oklch = { L: 0.16, C: 0.015, h: 55 };
const surface: Oklch = { L: 0.22, C: 0.02, h: 55 };
const ember: Oklch = { L: 0.7, C: 0.16, h: 55 };
const text: Oklch = { L: 0.9, C: 0.02, h: 75 };
// Active slot fill: color-mix(in oklch, var(--ember) 12%, var(--surface)).
const slotFill = mixOklch(ember, surface, 0.12);

const checks: { name: string; value: number; min: number }[] = [
  { name: "ember ring vs bg (the gap)", value: ratio(ember, bg), min: 3 },
  { name: "ember ring vs active slot fill", value: ratio(ember, slotFill), min: 3 },
  { name: "active number (text) vs slot fill", value: ratio(text, slotFill), min: 4.5 },
];

let failed = false;
for (const c of checks) {
  const ok = c.value >= c.min;
  failed ||= !ok;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}: ${c.value.toFixed(2)}:1 (min ${c.min}:1)`);
}
process.exit(failed ? 1 : 0);
