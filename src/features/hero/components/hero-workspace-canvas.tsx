"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTheme } from "next-themes";
import * as THREE from "three";
import {
  Environment,
  MeshTransmissionMaterial,
  OrbitControls,
  PerspectiveCamera,
  RoundedBoxGeometry,
} from "@react-three/drei";

import { fa } from "@/content/fa";

/**
 * The hero workspace as an actual Three.js scene — not a CSS effect.
 *
 * The same developer UI as before (browser window, code editor, component
 * tree, tech badges) is rebuilt as physical glass geometry: rounded bodies
 * with real thickness, canvas-painted faces carrying the same content, lit by
 * a cyan key light with soft shadows. Pointer movement eases the whole rig
 * (camera-grade parallax), so depth is revealed rather than implied.
 *
 * Boundaries, copied from the global scene's contract:
 * - Client-only behind a dynamic import (`ssr: false`), so there is no SSR
 *   HTML to mismatch and no hydration risk.
 * - `animated=false` (reduced motion) renders one static frame: final
 *   positions, full opacity, no loop.
 * - Textures are created in memos and disposed in effects; geometries and
 *   JSX materials are owned (and disposed) by React Three Fiber.
 *
 * OrbitControls stays rotation-only and enabled only for fine pointers:
 * zoom would capture the page's wheel scroll over the canvas, pan would lose
 * the composition, and on touch devices any control would trap vertical
 * swipes — so mobile keeps scrolling while desktop keeps orbiting. Drag-orbit
 * and the hover rig coexist: one answers drags, the other answers hovers.
 */

type WorkspacePalette = {
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
};

const DARK: WorkspacePalette = {
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
};

const LIGHT: WorkspacePalette = {
  card: "#ffffff",
  cardSoft: "#eef3f6",
  border: "rgba(14, 116, 144, 0.35)",
  text: "#000",
  muted: "#5b6b7a",
  cyan: "#0e7490",
  violet: "#7c5cf0",
  edge: "#c9d4dd",
  shadowOpacity: 0.14,
  faceAlpha: 0.78,
  glassRoughness: 0.12,
};

/* ------------------------------------------------------------------ */
/* Canvas-painted faces                                                 */
/* ------------------------------------------------------------------ */

function makeLayer(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

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

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function useFaceTexture(
  width: number,
  height: number,
  palette: WorkspacePalette,
  draw: (
    ctx: CanvasRenderingContext2D,
    palette: WorkspacePalette,
    width: number,
    height: number,
  ) => void,
): THREE.CanvasTexture {
  const texture = useMemo(() => {
    const { canvas, ctx } = makeLayer(width, height);
    draw(ctx, palette, width, height);
    return toTexture(canvas);
    // Drawn once per palette/size; theme flips rebuild the texture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, palette]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function drawBrowserFace(
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

function drawEditorFace(
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

function drawTreeFace(
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

const drawBadgeFace =
  (label: string) =>
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

/* ------------------------------------------------------------------ */
/* 3D pieces                                                            */
/* ------------------------------------------------------------------ */

function easeInOut(t: number) {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

type PanelProps = {
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  depth: number;
  /** Corner radius of the glass body; pills pass a larger one. */
  radius?: number;
  texture: THREE.CanvasTexture;
  /** Transmission finish, tuned per theme (clearer on bright pages). */
  glassRoughness: number;
  /** Subtle cyan tint refracted through the glass edges. */
  glassTint: string;
  delay: number;
  animated: boolean;
};

/**
 * One physical UI panel: a rounded glass body with real thickness, plus a
 * painted face floating a hair in front so content stays crisp while the
 * body refracts the scene behind it. Entrance is a rise plus a face fade —
 * the glass itself is present from the first frame, so nothing pops.
 */
function Panel({
  position,
  rotation,
  size,
  depth,
  radius = 0.06,
  texture,
  glassRoughness,
  glassTint,
  delay,
  animated,
}: PanelProps) {
  const group = useRef<THREE.Group>(null);
  const faceMaterial = useRef<THREE.MeshStandardMaterial>(null);

  const [width, height] = size;
  useFrame(({ clock }) => {
    const node = group.current;
    if (!node) return;
    const progress = animated
      ? easeInOut((clock.elapsedTime - delay) / 0.9)
      : 1;
    node.position.set(
      position[0],
      position[1] - (1 - progress) * 0.35,
      position[2],
    );
    // Ref writes only: no memo is mutated, so the compiler rule stays happy.
    if (faceMaterial.current) {
      faceMaterial.current.opacity = progress;
    }
  });

  return (
    <group ref={group} position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <RoundedBoxGeometry args={[width, height, depth]} radius={radius} />
        <MeshTransmissionMaterial
          resolution={256}
          roughness={glassRoughness}
          attenuationColor={glassTint}
          attenuationDistance={2.5}
        />
      </mesh>
      <mesh position={[0, 0, depth / 2 + 0.002]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          ref={faceMaterial}
          map={texture}
          transparent
          roughness={0.3}
          opacity={animated ? 0 : 1}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Workspace scene                                                      */
/* ------------------------------------------------------------------ */

function WorkspaceScene({
  palette,
  animated,
  interactive,
}: {
  palette: WorkspacePalette;
  animated: boolean;
  interactive: boolean;
}) {
  const rig = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0, active: false });
  const size = useThree((state) => state.size);
  /*
   * Fit the fixed world layout into the canvas: the camera always shows 5.46
   * world units of height, so visible width follows the canvas aspect. Scale
   * the rig down only when the layout (5 wide) would otherwise overflow.
   * `size` here is canvas pixels — never confused with the viewport, which
   * decides the simplified variant one level up.
   */
  const visibleWidth = 5.46 * (size.width / Math.max(size.height, 1));
  const rigScale = Math.min(1, visibleWidth / 5.0);

  const browserTexture = useFaceTexture(1024, 640, palette, drawBrowserFace);
  const editorTexture = useFaceTexture(600, 600, palette, drawEditorFace);
  const treeTexture = useFaceTexture(440, 470, palette, drawTreeFace);
  const typeScriptTexture = useFaceTexture(
    384,
    128,
    palette,
    drawBadgeFace("TypeScript"),
  );
  const nextTexture = useFaceTexture(
    384,
    128,
    palette,
    drawBadgeFace("Next.js"),
  );

  useEffect(() => {
    if (!interactive) return;
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
      pointer.current.active = true;
    };
    const onLeave = () => {
      pointer.current.active = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [interactive]);

  useFrame((state, delta) => {
    const node = rig.current;
    if (!node) return;
    const step = Math.min(delta, 0.05);
    const target = pointer.current.active ? pointer.current : { x: 0, y: 0 };
    // Eased rig tilt: the composition leans a few degrees toward the cursor,
    // while nearer panels (larger |z|) naturally travel farther — that is the
    // parallax, and it comes free from the perspective camera.
    node.rotation.y +=
      (target.x * 0.16 - node.rotation.y) * Math.min(step * 3, 1);
    node.rotation.x +=
      (-target.y * 0.11 - node.rotation.x) * Math.min(step * 3, 1);
    if (animated) {
      node.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.03;
    }
  });

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[4, 6, 7]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <pointLight
        position={[-3.5, 2.5, 4]}
        intensity={22}
        color={palette.cyan}
      />
      <pointLight position={[3, -2, 3]} intensity={8} color={palette.violet} />

      <group ref={rig} scale={rigScale} rotation={[0, -0.05, 0]}>
        <Panel
          position={[-0.35, 0.25, -0.5]}
          rotation={[0.02, -0.1, 0]}
          size={[3.5, 2.2]}
          depth={0.14}
          texture={browserTexture}
          glassRoughness={palette.glassRoughness}
          glassTint={palette.cyan}
          delay={0.35}
          animated={animated}
        />
        <Panel
          position={[1.05, -0.75, 0.75]}
          rotation={[-0.01, 0.15, 0]}
          size={[1.95, 2.05]}
          depth={0.12}
          texture={editorTexture}
          glassRoughness={palette.glassRoughness}
          glassTint={palette.cyan}
          delay={0.55}
          animated={animated}
        />
        <>
          <Panel
            position={[-1.68, 0.88, 0.35]}
            rotation={[0, -0.06, 0]}
            size={[1.38, 1.48]}
            depth={0.09}
            texture={treeTexture}
            glassRoughness={palette.glassRoughness}
            glassTint={palette.cyan}
            delay={0.45}
            animated={animated}
          />
          <Panel
            position={[-1.3, -0.6, 1.35]}
            rotation={[0, 0.12, 0]}
            size={[1.08, 0.37]}
            depth={0.08}
            radius={0.16}
            texture={typeScriptTexture}
            glassRoughness={palette.glassRoughness}
            glassTint={palette.cyan}
            delay={0.7}
            animated={animated}
          />
          <Panel
            position={[1.4, 1.1, 0.9]}
            rotation={[0, 0.1, 0]}
            size={[1.08, 0.37]}
            depth={0.08}
            radius={0.16}
            texture={nextTexture}
            glassRoughness={palette.glassRoughness}
            glassTint={palette.cyan}
            delay={0.78}
            animated={animated}
          />
        </>
      </group>
    </>
  );
}

function SolidColorEnvironment() {
  const { theme } = useTheme();

  const solidColorTexture = useMemo(() => {
    // 64×64 keeps the PMREM mip chain valid — a 1×1 source breaks the
    // CubeUV shader (SwiftShader/ANGLE validates `face * faceSize` with a
    // strict int→float check and then fails every envMap program).
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim() || "#000";
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }, [theme]);

  useEffect(() => () => solidColorTexture.dispose(), [solidColorTexture]);

  // Set both the IBL environment and the visible background — the glass
  // needs the former to refract, the page needs the latter for contrast.
  return <Environment map={solidColorTexture} background />;
}

export function HeroWorkspaceCanvas({
  animated,
  interactive,
}: {
  animated: boolean;
  interactive: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const palette = resolvedTheme === "light" ? LIGHT : DARK;

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      shadows
      frameloop={animated ? "always" : "demand"}
    >
      <PerspectiveCamera makeDefault position={[0, 0.15, 8.4]} fov={36} />
      {/*
       * Rotation-only orbit as a second layer over the hover rig: drags orbit,
       * hovers parallax. Zoom and pan stay off — zoom would steal the page's
       * wheel scroll over the canvas, pan would lose the composition. Limited
       * angles keep every face readable; disabled entirely without a fine
       * pointer so touch swipes keep scrolling the page.
       */}
      <OrbitControls
        enabled={interactive && animated}
        enableZoom={false}
        enablePan={false}
        rotateSpeed={0.6}
        minPolarAngle={Math.PI / 2 - 0.45}
        maxPolarAngle={Math.PI / 2 + 0.45}
        minAzimuthAngle={-0.7}
        maxAzimuthAngle={0.7}
      />

      <SolidColorEnvironment />

      <WorkspaceScene
        palette={palette}
        animated={animated}
        interactive={interactive && animated}
      />
    </Canvas>
  );
}
