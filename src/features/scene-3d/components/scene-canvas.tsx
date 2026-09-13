"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Ambient starfield: custom GLSL points, a constellation layer, and a soft
 * central glow.
 *
 * Why custom shaders instead of PointsMaterial: per-particle twinkle phase,
 * size variety, depth-graded colour and a cursor repulsion field are all one
 * GPU pass here. The equivalent with built-in materials would be per-frame CPU
 * updates of 650 positions — the exact kind of work that janks on mobile.
 *
 * Still ambient, still cheap: one draw call for the points, one for the lines,
 * one sprite. No post-processing chain.
 */

/* ------------------------------------------------------------------ */
/* Deterministic field data (module scope: zero render-time work, no    */
/* hydration risk — server and client roll the identical sky)           */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARTICLE_COUNT = 240;
const MOBILE_PARTICLE_COUNT = 120;
const FIELD_SEED = 20260906;
/** Pairs closer than this get a constellation segment. */
const LINK_DISTANCE = 0.65;
const MAX_LINKS = 180;
const MOBILE_LINK_COUNT = 70;

type FieldData = {
  positions: Float32Array;
  phases: Float32Array;
  scales: Float32Array;
  mixes: Float32Array;
  linkPositions: Float32Array;
};

function buildField(): FieldData {
  const rand = mulberry32(FIELD_SEED);
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const phases = new Float32Array(PARTICLE_COUNT);
  const scales = new Float32Array(PARTICLE_COUNT);
  const mixes = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Uniform in a flattened sphere: cbrt keeps density even, the squash keeps
    // the field wide to match a landscape viewport.
    const radius = 4.5 * Math.cbrt(rand());
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
    positions[i * 3 + 2] = radius * Math.cos(phi) * 0.6 - 1;
    phases[i] = rand();
    // A few hero stars among the dust: mostly small, rarely visible. Kept
    // deliberately faint so the field reads as depth, not as competition with
    // the Persian headline.
    scales[i] = rand() < 0.05 ? 1.3 + rand() * 0.7 : 0.45 + rand() * 0.55;
    // Colour mix: outer particles drift toward the deep tone.
    mixes[i] = Math.min(1, radius / 4.5) * 0.7 + rand() * 0.3;
  }

  // Constellation segments: nearest pairs under the threshold, shortest first.
  // Computed once — the lines live in the same rotating group as the points,
  // so they never need per-frame updates.
  const candidates: { distance: number; a: number; b: number }[] = [];
  for (let a = 0; a < PARTICLE_COUNT; a++) {
    for (let b = a + 1; b < PARTICLE_COUNT; b++) {
      const dx = positions[a * 3]! - positions[b * 3]!;
      const dy = positions[a * 3 + 1]! - positions[b * 3 + 1]!;
      const dz = positions[a * 3 + 2]! - positions[b * 3 + 2]!;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance < LINK_DISTANCE) candidates.push({ distance, a, b });
    }
  }
  candidates.sort((x, y) => x.distance - y.distance);
  const links = candidates.slice(0, MAX_LINKS);
  const linkPositions = new Float32Array(links.length * 6);
  links.forEach((link, i) => {
    linkPositions[i * 6] = positions[link.a * 3]!;
    linkPositions[i * 6 + 1] = positions[link.a * 3 + 1]!;
    linkPositions[i * 6 + 2] = positions[link.a * 3 + 2]!;
    linkPositions[i * 6 + 3] = positions[link.b * 3]!;
    linkPositions[i * 6 + 4] = positions[link.b * 3 + 1]!;
    linkPositions[i * 6 + 5] = positions[link.b * 3 + 2]!;
  });

  return { positions, phases, scales, mixes, linkPositions };
}

const FIELD = buildField();

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const VERTEX_SHADER = /* glsl */ `
  attribute float aPhase;
  attribute float aScale;
  attribute float aMix;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2 uMouseWorld;
  uniform vec4 uQuiet;
  varying vec3 vColor;
  varying float vAlpha;
  uniform vec3 uBright;
  uniform vec3 uDeep;

  void main() {
    vec3 p = position;

    // Cursor repulsion: particles part around the pointer in the XY plane.
    // uMouseWorld is the pointer mapped into world units at the field's depth,
    // so the effect tracks the cursor instead of lagging behind it.
    vec2 diff = p.xy - uMouseWorld;
    float dist = length(diff);
    float force = smoothstep(1.4, 0.0, dist) * 0.4;
    p.xy += (diff / max(dist, 0.0001)) * force;

    // Slow individual drift on top of the rigid group rotation, so the field
    // never looks frozen even when the group barely moves. Very restrained.
    p.x += sin(uTime * 0.08 + aPhase * 6.2831) * 0.04;
    p.y += cos(uTime * 0.06 + aPhase * 6.2831) * 0.04;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    gl_Position = clip;

    // Quiet zone: fade particles near the headline in screen space. Because
    // this is computed after projection, the calm area stays aligned with the
    // text even while the field itself rotates slowly behind it.
    vec2 ndc = clip.xy / max(abs(clip.w), 0.0001);
    float quietDistance = distance(ndc, uQuiet.xy);
    float quiet = smoothstep(uQuiet.z * 0.35, uQuiet.z, quietDistance);

    // Twinkle: each particle pulses gently on its own phase and frequency.
    // Kept subdued so the field reads as quiet depth, not as a light show.
    float tw = 0.65 + 0.35 * sin(uTime * (0.35 + aPhase * 0.8) + aPhase * 6.2831);
    vAlpha = tw * mix(1.0, quiet, uQuiet.w);
    vColor = mix(uBright, uDeep, aMix);

    gl_PointSize = uPixelRatio * aScale * (140.0 / -mv.z) * (0.75 + 0.45 * tw);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uOpacity;

  void main() {
    // Soft disc: no textures, no atlas — the sprite is pure math.
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float disc = smoothstep(0.5, 0.1, d);
    if (disc * vAlpha * uOpacity < 0.01) discard;
    gl_FragColor = vec4(vColor, disc * vAlpha * uOpacity);
  }
`;

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

export type SceneScheme = {
  bright: string;
  deep: string;
  opacity: number;
  lineOpacity: number;
  glowOpacity: number;
  /** Additive light looks neon on dark; on a light page it washes to white,
      so the light scheme composites normally with darker inks. */
  additive: boolean;
};

function useGlowTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.25)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);
}

function Starfield({ scheme }: { scheme: SceneScheme }) {
  const group = useRef<THREE.Group>(null);

  /*
   * Fresh material when the scheme flips. The alternative — mutating the live
   * material's blending and uniforms in an effect — trips the compiler rule
   * against modifying memo values after render, and the alternative to that (a
   * disposal cleanup closing over the material) trips it too. Re-creating is
   * the compliant shape, and it is cheap: the shader code is identical across
   * schemes, so three.js reuses the compiled program from its cache and only
   * the uniforms are new. The orphaned material is GC'd with its geometries.
   */
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: scheme.additive
          ? THREE.AdditiveBlending
          : THREE.NormalBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uMouseWorld: { value: new THREE.Vector2(999, 999) },
          uQuiet: { value: new THREE.Vector4(0.34, 0.08, 0.72, 0.9) },
          uOpacity: { value: scheme.opacity },
          uBright: { value: new THREE.Color(scheme.bright) },
          uDeep: { value: new THREE.Color(scheme.deep) },
        },
      }),
    [scheme],
  );

  /*
   * The frame loop reaches the material through a ref, not the memo binding.
   * Memo values are immutable by contract, so mutating uniforms through the
   * `material` binding inside useFrame trips the compiler rule — refs are the
   * sanctioned mutable container. Synced with a plain assignment in an effect
   * body (not a cleanup, not setState), which is the allowed shape.
   */
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  useEffect(() => {
    materialRef.current = material;
  }, [material]);

  const glowTexture = useGlowTexture();
  const mouseNdc = useRef({ x: 0, y: 0, active: false });
  const scroll = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const size = useThree((state) => state.size);
  const viewportDpr = useThree((state) => state.viewport.dpr);

  // Narrow viewports get a sparser field from the same deterministic layout.
  // Subarrays are views into the shared buffers, so no additional geometry
  // memory is allocated for the mobile variant.
  const isNarrow = size.width < 640;
  const pointPositions = isNarrow
    ? FIELD.positions.subarray(0, MOBILE_PARTICLE_COUNT * 3)
    : FIELD.positions;
  const pointPhases = isNarrow
    ? FIELD.phases.subarray(0, MOBILE_PARTICLE_COUNT)
    : FIELD.phases;
  const pointScales = isNarrow
    ? FIELD.scales.subarray(0, MOBILE_PARTICLE_COUNT)
    : FIELD.scales;
  const pointMixes = isNarrow
    ? FIELD.mixes.subarray(0, MOBILE_PARTICLE_COUNT)
    : FIELD.mixes;
  const constellationPositions = isNarrow
    ? FIELD.linkPositions.subarray(0, MOBILE_LINK_COUNT * 6)
    : FIELD.linkPositions;

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      mouseNdc.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseNdc.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
      mouseNdc.current.active = true;
    };
    const onPointerLeave = () => {
      mouseNdc.current.active = false;
    };
    const onScroll = () => {
      scroll.current = window.scrollY;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener(
      "pointerleave",
      onPointerLeave,
    );
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener(
        "pointerleave",
        onPointerLeave,
      );
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useFrame((_, delta) => {
    const node = group.current;
    const live = materialRef.current;
    if (!node || !live) return;
    const step = Math.min(delta, 0.05);
    const uniforms = live.uniforms as {
      uTime: { value: number };
      uPixelRatio: { value: number };
      uMouseWorld: { value: THREE.Vector2 };
      uQuiet: { value: THREE.Vector4 };
    };

    uniforms.uTime.value += step;
    uniforms.uPixelRatio.value = viewportDpr;

    // Keep the calmest part of the field behind the headline while the hero is
    // visible. On wide screens the Persian column sits right of center; on
    // narrow screens the stacked headline sits near the top. Fade the effect
    // as the visitor leaves the hero so lower sections keep their atmosphere.
    const quiet = uniforms.uQuiet.value;
    const heroVisibility = Math.max(
      0,
      1 - scroll.current / (window.innerHeight * 0.8),
    );
    if (size.width >= size.height) {
      quiet.set(0.34, 0.08, 0.72, 0.9 * heroVisibility);
    } else {
      quiet.set(0, 0.42, 0.58, 0.62 * heroVisibility);
    }

    // World-units-per-NDC at the field's depth: visible half-height at z=0
    // with the camera at z=7, fov 60. Keeps the repulsion glued to the cursor.
    const worldHalfHeight = 7 * Math.tan(THREE.MathUtils.degToRad(30));
    const worldHalfWidth = worldHalfHeight * (size.width / size.height);
    const mouse = uniforms.uMouseWorld.value;
    if (mouseNdc.current.active) {
      mouse.x +=
        (mouseNdc.current.x * worldHalfWidth - mouse.x) * step * 4;
      mouse.y +=
        (mouseNdc.current.y * worldHalfHeight - mouse.y) * step * 4;
    } else {
      // Parked far away when the pointer leaves: repulsion eases out instead
      // of snapping.
      mouse.x += (999 - mouse.x) * step * 4;
      mouse.y += (999 - mouse.y) * step * 4;
    }

    node.rotation.y += step * 0.015;
    const targetY = -(scroll.current / window.innerHeight) * 0.6;
    node.position.y += (targetY - node.position.y) * step * 2;
  });

  return (
    <group ref={group}>
      <points frustumCulled={false}>
        <bufferGeometry key={isNarrow ? "narrow" : "wide"}>
          <bufferAttribute attach="attributes-position" args={[pointPositions, 3]} />
          <bufferAttribute attach="attributes-aPhase" args={[pointPhases, 1]} />
          <bufferAttribute attach="attributes-aScale" args={[pointScales, 1]} />
          <bufferAttribute attach="attributes-aMix" args={[pointMixes, 1]} />
        </bufferGeometry>
        <primitive object={material} attach="material" />
      </points>

      {/* Constellation layer: static geometry in the same group, so it rides
          the rotation for free with zero per-frame cost. */}
      <lineSegments frustumCulled={false}>
        <bufferGeometry key={isNarrow ? "narrow" : "wide"}>
          <bufferAttribute
            attach="attributes-position"
            args={[constellationPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={scheme.bright}
          transparent
          opacity={scheme.lineOpacity}
          depthWrite={false}
          blending={
            scheme.additive ? THREE.AdditiveBlending : THREE.NormalBlending
          }
        />
      </lineSegments>

      {/* Soft ambient glow, kept left of the headline so it supports the visual
          workspace without competing with the typography. */}
      <sprite position={[-1.4, -0.3, -4.5]} scale={[12, 12, 1]}>
        <spriteMaterial
          map={glowTexture}
          color={scheme.bright}
          transparent
          opacity={scheme.glowOpacity}
          depthWrite={false}
          blending={
            scheme.additive ? THREE.AdditiveBlending : THREE.NormalBlending
          }
        />
      </sprite>
    </group>
  );
}

export function SceneCanvas({ scheme }: { scheme: SceneScheme }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 7], fov: 60 }}
    >
      <Starfield scheme={scheme} />
    </Canvas>
  );
}
