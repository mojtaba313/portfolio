"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/**
 * The hero workspace as an actual Three.js scene — not a CSS effect.
 *
 * The same developer UI as before (browser window, code editor, component
 * tree, tech badges) is rebuilt as physical glass geometry: rounded bodies
 * with real thickness, canvas-painted faces carrying the same content, lit by
 * a cyan key light. Pointer movement eases the whole rig
 * (camera-grade parallax), so depth is revealed rather than implied.
 *
 * Performance budget (the glass stays — everything around it got cheaper):
 * - No shadow maps: the panels had no floor to land on, only subtle
 *   inter-panel shading, so the per-frame shadow pass bought almost nothing.
 * - DPR capped at 1.25: fragment cost scales quadratically, and the canvas
 *   is a mid-size panel, not fullscreen.
 * - `low-power` preference: integrated GPUs stay quiet; the fan stays off.
 * - The loop pauses offscreen: once the hero scrolls out of view the canvas
 *   drops to on-demand rendering instead of burning 60fps on pixels nobody
 *   sees (same contract as the skills constellation).
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

import type { WorkspacePalette } from "./workspace-faces";
import {
  DARK,
  LIGHT,
  drawBadgeFace,
  drawBrowserFace,
  drawEditorFace,
  drawTreeFace,
} from "./workspace-faces";

/* ------------------------------------------------------------------ */
/* Canvas-texture bridge (three.js side)                                */
/* ------------------------------------------------------------------ */

function makeLayer(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
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
  /** Body volume + thin-film sheen; zero in dark, structural in light. */
  glassThickness: number;
  glassIridescence: number;
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
  glassThickness,
  glassIridescence,
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
      <mesh>
        <RoundedBoxGeometry args={[width, height, depth]} radius={radius} />
        <MeshTransmissionMaterial
          resolution={256}
          roughness={glassRoughness}
          thickness={glassThickness}
          chromaticAberration={0.06}
          iridescence={glassIridescence}
          iridescenceIOR={1.3}
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
      <ambientLight intensity={palette.ambientIntensity} />
      <directionalLight position={[4, 6, 7]} intensity={1.5} />
      <pointLight
        position={[-3.5, 2.5, 4]}
        intensity={palette.glowCyan}
        color={palette.cyan}
      />
      <pointLight
        position={[3, -2, 3]}
        intensity={palette.glowViolet}
        color={palette.violet}
      />

      <group ref={rig} scale={rigScale} rotation={[0, -0.05, 0]}>
        <Panel
          position={[-0.35, 0.25, -0.5]}
          rotation={[0.02, -0.1, 0]}
          size={[3.5, 2.2]}
          depth={0.14}
          texture={browserTexture}
          glassRoughness={palette.glassRoughness}
          glassTint={palette.cyan}
          glassThickness={palette.glassThickness}
          glassIridescence={palette.glassIridescence}
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
          glassThickness={palette.glassThickness}
          glassIridescence={palette.glassIridescence}
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
            glassThickness={palette.glassThickness}
            glassIridescence={palette.glassIridescence}
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
            glassThickness={palette.glassThickness}
            glassIridescence={palette.glassIridescence}
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
            glassThickness={palette.glassThickness}
            glassIridescence={palette.glassIridescence}
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

  /*
   * Offscreen pause: while the hero is scrolled out of view the render loop
   * drops to on-demand — no 60fps burn for invisible pixels. State flips only
   * from the observer callback, and the initial `true` matches the server
   * render, so there is no hydration risk (this whole tree is client-only
   * behind `ssr: false` anyway).
   */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? true),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="h-full w-full">
      <Canvas
        dpr={[1, 1.25]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        frameloop={animated && inView ? "always" : "demand"}
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
    </div>
  );
}
