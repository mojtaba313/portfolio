import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import type { GraphData } from "@/lib/db/projects";

import { CATEGORY_COLORS, PROJECT_NODE_COLOR } from "./graph-theme";

const FALLBACK_NODE_COLOR = "#737373";

/** Node radius from proficiency 1–5: 9.5px for a novice skill, 19.5px at mastery. */
function skillRadius(proficiency: number): number {
  return 7 + proficiency * 2.5;
}

/**
 * Project radius from connected-skill count, capped so a project linked to many
 * skills does not swallow its neighbours.
 */
function projectRadius(skillCount: number): number {
  return 9 + Math.min(skillCount, 8);
}

/**
 * Force-layout model for the skills graph.
 *
 * Kept separate from the canvas component so the graph topology (what connects
 * to what, how big each node is) is testable without a DOM or a canvas. The
 * component owns rendering and interaction; this module owns the physics input.
 */

export type GraphNodeKind = "skill" | "project";

export interface GraphNode extends SimulationNodeDatum {
  /** Unique across both kinds: `skill:<db-id>` or `project:<db-id>`. */
  id: string;
  kind: GraphNodeKind;
  /** Display text. Latin for skills, Persian for projects — never translated. */
  label: string;
  color: string;
  radius: number;
  /** Project nodes link to their detail page; skill nodes select in place. */
  url: string | null;
  /** Skill category, used for the legend. Null on project nodes. */
  category: string | null;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  /** Normalised 0–1 from the join-table weight; stronger edges pull tighter. */
  strength: number;
}

export function buildGraph(
  data: GraphData,
  palette: Record<string, string> = CATEGORY_COLORS,
): {
  nodes: GraphNode[];
  links: GraphLink[];
} {
  const nodes: GraphNode[] = [
    ...data.skills.map(
      (skill): GraphNode => ({
        id: `skill:${skill.id}`,
        kind: "skill",
        label: skill.name,
        color:
          skill.color ?? palette[skill.category] ?? FALLBACK_NODE_COLOR,
        radius: skillRadius(skill.proficiency),
        url: null,
        category: skill.category,
      }),
    ),
    ...data.projects.map(
      (project): GraphNode => ({
        id: `project:${project.id}`,
        kind: "project",
        label: project.title,
        color: PROJECT_NODE_COLOR,
        radius: projectRadius(project.skills.length),
        url: `/projects/${project.slug}`,
        category: null,
      }),
    ),
  ];

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links: GraphLink[] = [];

  for (const project of data.projects) {
    const target = byId.get(`project:${project.id}`);
    if (!target) continue;

    for (const edge of project.skills) {
      const source = byId.get(`skill:${edge.skillId}`);
      // A dangling edge means the skill list and the project list disagree —
      // skip it rather than crashing the simulation with an undefined endpoint.
      if (!source) continue;
      links.push({ source, target, strength: edge.weight / 5 });
    }
  }

  return { nodes, links };
}

export function createSimulation(
  nodes: GraphNode[],
  links: GraphLink[],
  width: number,
  height: number,
): Simulation<GraphNode, GraphLink> {
  return (
    forceSimulation(nodes)
      // Gentle repulsion: enough to untangle the initial clump, not so much
      // that the graph explodes past the canvas on wide screens.
      .force("charge", forceManyBody().strength(-140))
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((node) => node.id)
          .distance(85)
          // Base pull plus the edge weight, so a primary technology sits
          // visibly closer to its project than a peripheral one.
          .strength((link) => 0.15 + link.strength * 0.2),
      )
      .force(
        "collide",
        forceCollide<GraphNode>().radius((node) => node.radius + 8),
      )
      .force("center", forceCenter(width / 2, height / 2))
  );
}

/**
 * Settles a simulation synchronously for the reduced-motion path.
 *
 * Runs the physics to completion without any animation frames, so the static
 * layout is the same arrangement a sighted user would eventually see — not a
 * random scatter. Deterministic given the same input order, which also makes it
 * the layout to snapshot if this ever gets a visual test.
 */
export function settleSimulation(
  simulation: Simulation<GraphNode, GraphLink>,
  ticks = 300,
): void {
  for (let i = 0; i < ticks; i++) {
    simulation.tick();
  }
  simulation.stop();
}
