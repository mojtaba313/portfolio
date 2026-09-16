import type { GraphData } from "@/lib/db/projects";

/**
 * Pure constellation model.
 *
 * Why this exists instead of reusing force-layout.ts: that module builds a
 * bipartite skill<->project graph and needs d3-force to settle it (an O(n^2)
 * simulation that runs for hundreds of ticks). The constellation is a hub
 * topology — one core node, every skill orbiting it, plus a few faint
 * skill<->skill ties where two skills co-occur in the same project. Home
 * positions are computed deterministically in O(n), so the canvas engine only
 * needs cheap per-node springs instead of a physics simulation.
 *
 * No DOM, no canvas, no d3 import here: this module is unit-testable and
 * safe to import from server components.
 */

export type ConstellationNodeKind = "core" | "skill";

export interface ConstellationNode {
  /** `core` for the hub, otherwise `skill:<db-id>`. */
  id: string;
  kind: ConstellationNodeKind;
  /** Latin display name (skill names are Latin identifiers; core is MOJTABA). */
  label: string;
  /** Skill category, e.g. FRONTEND. Null on the core node. */
  category: string | null;
  proficiency: number;
  color: string;
  description: string | null;
  /** Ring assignment: 0 = inner orbit, 1 = outer orbit. */
  orbit: 0 | 1;
  /** Home position in CSS pixels, assigned by layoutConstellation(). */
  homeX: number;
  homeY: number;
  /** Visual radius in CSS pixels. */
  radius: number;
  /** Index of the angle slot, for staggered reveals. */
  order: number;
}

export interface ConstellationEdge {
  sourceId: string;
  targetId: string;
  /** 0 = core link, 1 = faint skill<->skill tie. */
  kind: 0 | 1;
}

export interface ConstellationModel {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  /** skill id -> projects using it, for the details panel. */
  skillProjects: Map<string, { slug: string; title: string }[]>;
}

const FALLBACK_COLOR = "#737373";

/** Node radius from proficiency 1–5, tightened so 24 nodes share two orbits. */
function skillRadius(proficiency: number): number {
  return 6 + proficiency * 1.8;
}

function proficiencyOf(value: number): number {
  if (Number.isFinite(value)) return Math.min(5, Math.max(1, Math.round(value)));
  return 3;
}

/**
 * Builds the hub model from live database rows — never a hardcoded tech list.
 *
 * Orbit assignment: the inner ring holds the highest-proficiency skills (up to
 * 8, the count that still breathes on mobile widths); everything else orbits
 * outside. Within each ring, nodes are interleaved by category so neighbouring
 * stars differ in hue instead of clumping into monochrome arcs.
 */
export function buildConstellation(
  data: GraphData,
  palette: Record<string, string> = {},
): ConstellationModel {
  const skillProjects = new Map<string, { slug: string; title: string }[]>();
  for (const project of data.projects) {
    for (const edge of project.skills) {
      const list = skillProjects.get(edge.skillId) ?? [];
      list.push({ slug: project.slug, title: project.title });
      skillProjects.set(edge.skillId, list);
    }
  }

  const sorted = [...data.skills].sort((a, b) => {
    if (b.proficiency !== a.proficiency) return b.proficiency - a.proficiency;
    if (a.displayOrder !== b.displayOrder)
      return a.displayOrder - b.displayOrder;
    return a.name.localeCompare(b.name);
  });

  const innerCount = Math.min(8, Math.ceil(sorted.length / 2));
  const rings: (typeof sorted)[] = [
    sorted.slice(0, innerCount),
    sorted.slice(innerCount),
  ];

  // Interleave categories within each ring for hue spread.
  for (const ring of rings) {
    const byCategory = new Map<string, (typeof sorted)[number][]>();
    for (const skill of ring) {
      const list = byCategory.get(skill.category) ?? [];
      list.push(skill);
      byCategory.set(skill.category, list);
    }
    const buckets = [...byCategory.values()];
    ring.length = 0;
    let taking = true;
    while (taking) {
      taking = false;
      for (const bucket of buckets) {
        const next = bucket.shift();
        if (next) {
          ring.push(next);
          taking = true;
        }
      }
    }
  }

  const nodes: ConstellationNode[] = [
    {
      id: "core",
      kind: "core",
      label: "MOJTABA",
      category: null,
      proficiency: 5,
      color: "#22d3ee",
      description: null,
      orbit: 0,
      homeX: 0,
      homeY: 0,
      radius: 30,
      order: -1,
    },
  ];

  let order = 0;
  rings.forEach((ring, orbit) => {
    for (const skill of ring) {
      nodes.push({
        id: `skill:${skill.id}`,
        kind: "skill",
        label: skill.name,
        category: skill.category,
        proficiency: proficiencyOf(skill.proficiency),
        color:
          skill.color ?? palette[skill.category] ?? FALLBACK_COLOR,
        description: skill.description,
        orbit: orbit as 0 | 1,
        homeX: 0,
        homeY: 0,
        radius: skillRadius(proficiencyOf(skill.proficiency)),
        order: order++,
      });
    }
  });

  const edges: ConstellationEdge[] = nodes
    .filter((node) => node.kind === "skill")
    .map((node) => ({ sourceId: "core", targetId: node.id, kind: 0 as const }));

  // Faint ties: skills that co-occur in the same project. Capped so the sky
  // keeps its negative space — at most ~10 ties, strongest co-occurrence first.
  const coOccurrence = new Map<string, number>();
  for (const project of data.projects) {
    const ids = project.skills.map((edge) => `skill:${edge.skillId}`);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        coOccurrence.set(key, (coOccurrence.get(key) ?? 0) + 1);
      }
    }
  }
  const known = new Set(nodes.map((node) => node.id));
  const ties = [...coOccurrence.entries()]
    .filter(
      ([key, count]) =>
        count >= 2 &&
        key.split("|").every((id) => known.has(id)),
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [key] of ties) {
    const [a, b] = key.split("|") as [string, string];
    edges.push({ sourceId: a, targetId: b, kind: 1 });
  }

  return { nodes, edges, skillProjects };
}

/**
 * Assigns deterministic home positions.
 *
 * Golden-angle distribution per ring (not force-directed): every mount with
 * the same data produces the same sky, which is what makes the reveal
 * choreography and any future visual snapshot stable. Radii are fractions of
 * the viewport's smaller side so the constellation survives narrow mobile
 * widths; the core sits slightly above centre to leave room for its label.
 */
export function layoutConstellation(
  model: ConstellationModel,
  width: number,
  height: number,
): void {
  const cx = width / 2;
  const cy = height / 2 - 8;
  const unit = Math.min(width, height);
  const radii = [unit * 0.21, unit * 0.38];

  for (const node of model.nodes) {
    if (node.kind === "core") {
      node.homeX = cx;
      node.homeY = cy;
      node.radius = Math.max(24, Math.min(32, unit * 0.075));
      continue;
    }
    const ring = model.nodes.filter(
      (entry) => entry.kind === "skill" && entry.orbit === node.orbit,
    );
    const slot = ring.findIndex((entry) => entry.id === node.id);
    // Offset the outer ring by half a step so stars never hide behind inner ones.
    const angle =
      slot * 2.39996 + node.orbit * 0.55 - Math.PI / 2 + (width < 560 ? 0.2 : 0);
    const wobble = ((slot * 37) % 10) / 10 - 0.5; // deterministic ±5% breathing room
    const radius = radii[node.orbit]! * (1 + wobble * 0.1);
    // Elliptical squash keeps side stars inside narrow containers.
    const squashX = width < 560 ? 0.86 : 1;
    node.homeX = cx + Math.cos(angle) * radius * squashX;
    node.homeY = cy + Math.sin(angle) * radius * 0.92;
  }
}
