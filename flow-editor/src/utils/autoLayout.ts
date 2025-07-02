import { Node, Edge } from 'reactflow';
import { NODE_DIMENSIONS, checkNodeOverlap, findFreeNodePosition } from './nodeUtils';

// פונקציה לחיפוש צמתי הורה
const getParentNodes = (nodeId: string, edges: Edge[]): string[] => {
  return edges
    .filter(edge => edge.target === nodeId)
    .map(edge => edge.source);
};

function getRootNodeId(nodes: Node[], edges: Edge[]): string | null {
  // חיפוש צומת התחלה (start) לפי הפרמטר isStartStep בdata
  const startNode = nodes.find(node => node.data?.isStartStep === true);
  if (startNode) {
    return startNode.id;
  }

  // אם לא נמצא צומת התחלה מוגדר, חפש צומת שאף אחד לא מצביע אליו
  const allNodeIds = new Set(nodes.map(n => n.id));
  const targetIds = new Set(edges.map(e => e.target));
  for (const id of Array.from(allNodeIds)) {
    if (!targetIds.has(id)) return id;
  }
  
  return nodes.length > 0 ? nodes[0].id : null;
}

// פונקציית עזר לבניית עץ היררכי מושלם
function buildAdvancedHierarchy(nodes: Node[], edges: Edge[]) {
  const nodeMap: Record<string, Node> = Object.fromEntries(nodes.map(n => [n.id, n]));
  const childrenMap: Record<string, string[]> = {};
  const levels: Record<string, number> = {};
  const branchMap: Record<string, string[]> = {}; // מעקב אחר ענפים מאותו שלב
  
  // איתחול
  nodes.forEach(n => { 
    childrenMap[n.id] = []; 
    branchMap[n.id] = [];
  });
  
  // בניית מפת ילדים עם זיהוי ענפים
  edges.forEach(e => {
    if (nodeMap[e.source] && nodeMap[e.target] && childrenMap[e.source]) {
      childrenMap[e.source].push(e.target);
      
      // זיהוי שלבים שיוצאים מ-options או conditions
      const sourceNode = nodeMap[e.source];
      if (sourceNode?.type === 'options' || sourceNode?.type === 'condition') {
        if (!branchMap[e.source]) branchMap[e.source] = [];
        branchMap[e.source].push(e.target);
      }
    }
  });
  
  const rootId = getRootNodeId(nodes, edges);
  
  // הגדרת רמות מתקדמת
  function assignLevels(nodeId: string, level: number, visited = new Set<string>()) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    if (levels[nodeId] === undefined || levels[nodeId] < level) {
    levels[nodeId] = level;
    }
    
    const sourceNode = nodeMap[nodeId];
    const children = childrenMap[nodeId] || [];
    
    // אם זה שלב עם ענפים, כל הילדים באותה רמה
    if ((sourceNode?.type === 'options' || sourceNode?.type === 'condition') && children.length > 1) {
      children.forEach(childId => {
        if (nodeMap[childId]) {
          assignLevels(childId, level + 1, new Set(visited));
        }
      });
    } else {
      // שלבים רגילים - רמה אחר רמה
      children.forEach(childId => {
        if (nodeMap[childId]) {
          assignLevels(childId, level + 1, new Set(visited));
        }
      });
    }
  }
  
  if (rootId) {
    assignLevels(rootId, 0);
  }
    
  // צמתים שלא חוברו
    nodes.forEach(node => {
    if (levels[node.id] === undefined) {
      levels[node.id] = 0;
      }
    });
  
  return { nodeMap, childrenMap, levels, rootId, branchMap };
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
) {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  console.log('🎯 מתחיל אלגוריתם סידור דרגות פשוט...');

  // הגדרות מרווח מסודרות ונוחות לעין
  const LEVEL_SPACING = 400;  // מרווח בין דרגות - יותר גדול למראה נקי
  const NODE_SPACING = 450;   // מרווח בין בלוקים באותה דרגה - יותר רחב עם מרווח X
  const START_Y = 150;        // מיקום התחלה - יותר רחוק מהקצה

  // בניית מפת קשרים
  const nodeMap: Record<string, Node> = Object.fromEntries(nodes.map(n => [n.id, n]));
  const childrenMap: Record<string, string[]> = {};
  const parentMap: Record<string, string> = {};
  
  // איתחול
  nodes.forEach(n => { childrenMap[n.id] = []; });
  
  // בניית מפות הורה-ילד
  edges.forEach(edge => {
    if (nodeMap[edge.source] && nodeMap[edge.target]) {
      childrenMap[edge.source].push(edge.target);
      parentMap[edge.target] = edge.source;
    }
  });

  // מציאת צומת התחלה (השורש)
  const rootId = getRootNodeId(nodes, edges);
  if (!rootId) return { nodes, edges };

  console.log(`🌱 צומת התחלה: ${rootId}`);
    
  // שלב 1: הגדרת דרגות - ההודעת פתיחה תהיה דרגה 1
  const ranks: Record<string, number> = {};
  const visited = new Set<string>();
  
  // BFS להגדרת דרגות
  const queue = [{ nodeId: rootId, rank: 1 }];
  
  while (queue.length > 0) {
    const { nodeId, rank } = queue.shift()!;
    
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    
    ranks[nodeId] = rank;
    console.log(`📍 צומת ${nodeId} קיבל דרגה ${rank}`);
    
    // הוספת הילדים לתור עם דרגה +1
    const children = childrenMap[nodeId] || [];
    children.forEach(childId => {
      if (!visited.has(childId) && nodeMap[childId]) {
        queue.push({ nodeId: childId, rank: rank + 1 });
      }
    });
  }

  // שלב 2: קיבוץ לפי דרגות
  const nodesByRank: Record<number, string[]> = {};
  Object.entries(ranks).forEach(([nodeId, rank]) => {
    if (!nodesByRank[rank]) nodesByRank[rank] = [];
    nodesByRank[rank].push(nodeId);
  });

  console.log('📊 צמתים לפי דרגות:', nodesByRank);

     // שלב 3: מיקום הצמתים עם מרווחים גדולים למניעת קווים חוצים
   const positions: Record<string, { x: number; y: number }> = {};
   
   Object.entries(nodesByRank).forEach(([rankStr, nodesInRank]) => {
     const rank = parseInt(rankStr);
     const y = START_Y + (rank - 1) * LEVEL_SPACING;
     
     if (nodesInRank.length === 1) {
       const nodeId = nodesInRank[0];
       
       // בלוק יחיד - תמיד במרכז למניעת קווים מעוותים
       positions[nodeId] = { x: 0, y };
       console.log(`🎯 דרגה ${rank}: בלוק יחיד ${nodeId} במרכז (0, ${y})`);
     } else {
       // מספר בלוקים - פיזור רחב מאוד כדי שקווים לא יחתכו
       const extraSpacing = NODE_SPACING * 1.5; // מרווח גדול יותר
       const totalWidth = (nodesInRank.length - 1) * extraSpacing;
    const startX = -totalWidth / 2;
       
       nodesInRank.forEach((nodeId, index) => {
         const x = startX + index * extraSpacing;
         positions[nodeId] = { x, y };
         console.log(`🎯 דרגה ${rank}: בלוק ${nodeId} במיקום רחב (${x}, ${y})`);
       });
          }
   });

  console.log('✅ סידור דרגות הושלם:', positions);
  console.log('🔗 עיבוד קווים:', edges.map(e => `${e.source}→${e.target} (${e.label || 'ללא תווית'})`));

  // עדכון nodes עם מיקומים חדשים
  const layoutedNodes = nodes.map((node) => {
    return {
      ...node,
      position: positions[node.id] ?? { x: 0, y: 0 },
      targetPosition: direction === 'LR' ? 'left' : 'top',
      sourcePosition: direction === 'LR' ? 'right' : 'bottom',
      data: {
        ...node.data,
      },
    };
  });

    // עדכון edges עם קווים פשוטים וישרים
  const layoutedEdges = edges.map((edge, index) => {
    const colors = ['#2563eb', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#14b8a6'];
    const edgeColor = colors[index % colors.length];
    
    return {
      ...edge,
      type: 'smoothstep', // קו חלק שעובר דרך פינות
      style: {
        stroke: edgeColor,
        strokeWidth: 3,
        opacity: 0.9,
        strokeDasharray: 'none',
      },
      animated: false,
      markerEnd: {
        type: 'arrowclosed',
        color: edgeColor,
        width: 16,
        height: 16,
      },
      labelStyle: {
        background: 'rgba(255,255,255,0.9)',
        color: edgeColor,
        fontSize: '12px',
        fontWeight: 500,
        padding: '4px 8px',
        borderRadius: '12px',
        border: `1px solid ${edgeColor}40`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      },
    };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
} 