import { Node, Edge } from 'reactflow';

const nodeWidth = 260;
const nodeHeight = 120;
const nodeSpacingX = 80;
const nodeSpacingY = 80;

function getRootNodeId(nodes: Node[], edges: Edge[]): string | null {
  // root הוא node שאין אליו אף edge
  const allNodeIds = new Set(nodes.map(n => n.id));
  const targetIds = new Set(edges.map(e => e.target));
  for (const id of allNodeIds) {
    if (!targetIds.has(id)) return id;
  }
  return nodes.length > 0 ? nodes[0].id : null;
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
) {
  // בניית עץ היררכי: לכל node נשמור children
  const nodeMap: Record<string, Node> = Object.fromEntries(nodes.map(n => [n.id, n]));
  const childrenMap: Record<string, string[]> = {};
  nodes.forEach(n => { childrenMap[n.id] = []; });
  edges.forEach(e => {
    if (childrenMap[e.source]) childrenMap[e.source].push(e.target);
  });

  // חישוב level (עומק) לכל node
  const levels: Record<string, number> = {};
  const rootId = getRootNodeId(nodes, edges);
  if (!rootId) return { nodes, edges };
  function assignLevels(nodeId: string, level: number) {
    if (levels[nodeId] !== undefined && levels[nodeId] <= level) return;
    levels[nodeId] = level;
    for (const childId of childrenMap[nodeId]) {
      assignLevels(childId, level + 1);
    }
  }
  assignLevels(rootId, 0);

  // קיבוץ nodes לפי level
  const levelsArr: string[][] = [];
  Object.entries(levels).forEach(([id, lvl]) => {
    if (!levelsArr[lvl]) levelsArr[lvl] = [];
    levelsArr[lvl].push(id);
  });

  // חישוב X/Y לכל node: כל רמה בשורה, כל siblings בריווח שווה
  const positions: Record<string, { x: number; y: number }> = {};
  for (let lvl = 0; lvl < levelsArr.length; lvl++) {
    const ids = levelsArr[lvl];
    const totalWidth = (ids.length - 1) * (nodeWidth + nodeSpacingX);
    for (let i = 0; i < ids.length; i++) {
      const x = -totalWidth / 2 + i * (nodeWidth + nodeSpacingX);
      const y = lvl * (nodeHeight + nodeSpacingY);
      positions[ids[i]] = { x, y };
    }
  }

  // עדכון nodes עם מיקום
  const layoutedNodes = nodes.map((node) => {
    return {
      ...node,
      position: {
        x: positions[node.id].x,
        y: positions[node.id].y,
      },
      targetPosition: direction === 'LR' ? 'left' : 'top',
      sourcePosition: direction === 'LR' ? 'right' : 'bottom',
      data: {
        ...node.data,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
} 