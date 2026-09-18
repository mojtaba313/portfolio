import { fa } from "@/content/fa";

/**
 * The painted faces of the hero workspace, as pure 2D canvas drawings.
 *
 * Split out of `hero-workspace-canvas.tsx` on purpose: that module imports
 * three.js, so anything imported from it drags ~1MB of WebGL into the
 * bundle. The static fallback (`WorkspaceFallback`) paints these same faces
 * onto plain `<canvas>` elements with zero 3D cost — identical artwork,
 * honest materials — and that is only possible from a module with no
 * three.js dependency. This file must never import three.
 */

export type WorkspacePalette = {
  card: string;
  cardSoft: string;
  border: string;
  text: string;
  muted: string;
  cyan: string;
  violet: string;
  edge: string;
  shadowOpacity: number;
  /**
   * Painted-face fill strength. Dark glass sits over a dark page, so a sheer
   * fill keeps depth; light glass sits over a bright page, where the same
   * sheerness would wash the content out.
   */
  faceAlpha: number;
  /** Transmission roughness: clearer glass against bright backgrounds. */
  glassRoughness: number;
  /**
   * Glass body volume. Dark mode refracts a dark scene, so zero thickness
   * suffices; on white the thin edges refract white-on-white (invisible),
   * so light mode gives the glass real thickness plus an iridescent sheen —
   * thin-film color that reads on bright backgrounds where point-light tint
   * alone washes out.
   */
  glassThickness: number;
  glassIridescence: number;
  /** Light rig per theme: dimmer ambient in light so the cyan/violet
   *  accents survive instead of drowning in white. */
  ambientIntensity: number;
  glowCyan: number;
  glowViolet: number;
};

/** One face painter: draws into `ctx` at the given pixel size. */
export type FaceDraw = (
  ctx: CanvasRenderingContext2D,
  palette: WorkspacePalette,
  width: number,
  height: number,
) => void;

export const DARK: WorkspacePalette = {
  card: "#141a22",
  cardSoft: "#1a222d",
  border: "rgba(103, 232, 249, 0.28)",
  text: "#e8eef4",
  muted: "#8d99a8",
  cyan: "#67e8f9",
  violet: "#a78bfa",
  edge: "#0b0f14",
  shadowOpacity: 0.28,
  faceAlpha: 0.5,
  glassRoughness: 0.3,
  glassThickness: 0,
  glassIridescence: 0,
  ambientIntensity: 0.75,
  glowCyan: 22,
  glowViolet: 8,
};

export const LIGHT: WorkspacePalette = {
  // Smoked glass: dark bodies on the bright page. White glass is invisible
  // against white surroundings no matter the tuning — dark surfaces are why
  // the dark mode composition works, so light mode borrows them. Crucially
  // the faces stay sheer (like dark mode): the blurred, refracted background
  // shows through the glass around the content instead of a flat opaque fill.
  card: "#16222f",
  cardSoft: "#22303f",
  border: "rgba(103, 232, 249, 0.4)",
  text: "#f4f8fc",
  muted: "#a9bfd2",
  cyan: "#22d3ee",
  violet: "#a78bfa",
  edge: "#0a141f",
  shadowOpacity: 0.14,
  faceAlpha: 0.6,
  glassRoughness: 0.3,
  glassThickness: 0.9,
  glassIridescence: 0.35,
  ambientIntensity: 0.6,
  glowCyan: 26,
  glowViolet: 12,
};

/** Native pixel sizes the 3D rig paints at; the fallback reuses them. */
export const FACE_SIZES = {
  browser: { width: 1024, height: 640 },
  editor: { width: 600, height: 600 },
  tree: { width: 440, height: 470 },
  badge: { width: 384, height: 128 },
} as const;

function roundedPanel(
  ctx: CanvasRenderingContext2D,
  palette: WorkspacePalette,
  width: number,
  height: number,
  radius: number,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, radius);
  ctx.fillStyle = palette.card;
  ctx.globalAlpha = palette.faceAlpha;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Lit top edge: the cyan key light catches the upper rim.
  ctx.beginPath();
  ctx.roundRect(1, 1, width - 2, height - 2, radius);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawBrowserFace(
  ctx: CanvasRenderingContext2D,
  palette: WorkspacePalette,
  width: number,
  height: number,
) {
  roundedPanel(ctx, palette, width, height, 28);
  const mono = (size: number) =>
    `${size}px "Geist Mono", ui-monospace, monospace`;

  // Chrome bar.
  ctx.fillStyle = palette.cardSoft;
  ctx.beginPath();
  ctx.roundRect(2, 2, width - 4, 92, [28, 28, 0, 0]);
  ctx.fill();
  ["#f87171", "#fbbf24", "#34d399"].forEach((color, i) => {
    ctx.beginPath();
    ctx.arc(52 + i * 36, 48, 11, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  // URL pill.
  ctx.fillStyle = palette.card;
  ctx.beginPath();
  ctx.roundRect(190, 24, 320, 48, 24);
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(222, 48, 8, 0, Math.PI * 2);
  ctx.fillStyle = palette.cyan;
  ctx.fill();
  ctx.fillStyle = palette.muted;
  ctx.font = mono(26);
  ctx.textBaseline = "middle";
  ctx.fillText("mojtaba.dev", 244, 50);

  // Miniature page skeleton.
  ctx.fillStyle = palette.cyan;
  ctx.beginPath();
  ctx.arc(64, 170, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.muted;
  ctx.fillRect(88, 162, 130, 16);
  ctx.fillStyle = palette.text;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(52, 210, 520, 30);
  ctx.globalAlpha = 0.55;
  ctx.fillRect(52, 256, 380, 30);
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.muted;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(52, 318, 640, 14);
  ctx.fillRect(52, 344, 540, 14);
  ctx.globalAlpha = 1;
  // CTA pair.
  ctx.fillStyle = palette.cyan;
  ctx.beginPath();
  ctx.roundRect(52, 390, 170, 54, 12);
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.beginPath();
  ctx.roundRect(238, 390, 170, 54, 12);
  ctx.stroke();
  // Rendered preview thumb with a cyan-lit top rim.
  const preview = ctx.createLinearGradient(0, 150, 0, 470);
  preview.addColorStop(0, palette.cyan);
  preview.addColorStop(0.25, palette.cardSoft);
  preview.addColorStop(1, palette.cardSoft);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = preview;
  ctx.beginPath();
  ctx.roundRect(740, 150, 220, 320, 18);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(740, 150, 220, 320, 18);
  ctx.stroke();

  // Status strip.
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, height - 66);
  ctx.lineTo(width - 2, height - 66);
  ctx.stroke();
  ctx.fillStyle = "#34d399";
  ctx.beginPath();
  ctx.arc(64, height - 33, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.muted;
  ctx.font = mono(24);
  ctx.fillText("200 OK", 88, height - 31);
  ctx.fillText("0.4s", width - 140, height - 31);
}

export function drawEditorFace(
  ctx: CanvasRenderingContext2D,
  palette: WorkspacePalette,
  width: number,
  height: number,
) {
  roundedPanel(ctx, palette, width, height, 15);
  const mono = (size: number) =>
    `${size}px "Geist Mono", ui-monospace, monospace`;
  ctx.fillStyle = palette.muted;
  ctx.font = mono(27);
  ctx.textBaseline = "middle";
  ctx.fillText(fa.home.heroCodeFile, 36, 52);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, 92);
  ctx.lineTo(width - 2, 92);
  ctx.stroke();

  const lines = fa.home.heroCode;
  ctx.font = mono(28);
  lines.forEach((line, i) => {
    const y = 155 + i * 56;
    ctx.fillStyle = palette.muted;
    ctx.globalAlpha = 0.55;
    ctx.fillText(String(i + 1), 36, y);
    ctx.globalAlpha = 1;
    if (i === 0) {
      ctx.fillStyle = palette.violet;
      ctx.fillText("const", 84, y);
      ctx.fillStyle = palette.text;
      ctx.fillText("experience = {", 200, y);
    } else if (i === lines.length - 1) {
      ctx.fillStyle = palette.text;
      ctx.fillText("};", 84, y);
    } else {
      const [key, ...rest] = line.split(":");
      ctx.fillStyle = palette.text;
      ctx.fillText(key.trim(), 84, y);
      const valueX = 84 + ctx.measureText(key.trim()).width + 34;
      ctx.fillStyle = palette.muted;
      ctx.fillText(":", valueX - 22, y);
      ctx.fillStyle = palette.cyan;
      ctx.fillText(rest.join(":").trim(), valueX, y);
    }
  });
  // Block cursor.
  ctx.fillStyle = palette.cyan;
  ctx.fillRect(84, 155 + lines.length * 56 - 18, 20, 36);
}

export function drawTreeFace(
  ctx: CanvasRenderingContext2D,
  palette: WorkspacePalette,
  width: number,
  height: number,
) {
  roundedPanel(ctx, palette, width, height, 24);
  const mono = (size: number) =>
    `${size}px "Geist Mono", ui-monospace, monospace`;
  ctx.fillStyle = palette.text;
  ctx.globalAlpha = 0.75;
  ctx.font = mono(30);
  ctx.textBaseline = "middle";
  ctx.fillText("components", 36, 52);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, 96);
  ctx.lineTo(width - 2, 96);
  ctx.stroke();

  const rows: { label: string; depth: number; active: boolean }[] = [
    { label: "App", depth: 0, active: true },
    { label: "Hero", depth: 1, active: false },
    { label: "Projects", depth: 1, active: false },
  ];
  rows.forEach((row, i) => {
    const y = 170 + i * 70;
    ctx.beginPath();
    ctx.arc(52 + row.depth * 48, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = row.active ? palette.cyan : palette.muted;
    ctx.globalAlpha = row.active ? 1 : 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = row.active ? palette.text : palette.muted;
    ctx.font = mono(33);
    ctx.fillText(row.label, 82 + row.depth * 48, y);
  });
}

export const drawBadgeFace =
  (label: string): FaceDraw =>
  (
    ctx: CanvasRenderingContext2D,
    palette: WorkspacePalette,
    width: number,
    height: number,
  ) => {
    roundedPanel(ctx, palette, width, height, height / 2);
    ctx.fillStyle = palette.text;
    ctx.font = `500 42px "Geist Mono", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, width / 2, height / 2 + 2);
  };
