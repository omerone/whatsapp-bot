import { Node, Edge } from 'reactflow';
import { NODE_DIMENSIONS, checkNodeOverlap, findFreeNodePosition } from './nodeUtils';

function getRootNodeId(nodes: Node[], edges: Edge[]): string | null {
  // חיפוש צומת התחלה (start) לפי הפרמטר isStartStep בdata
  const startNode = nodes.find(node => node.data?.isStartStep === true);
  if (startNode) {
    return startNode.id;
  }

  // אם לא נמצא צומת התחלה מוגדר, חפש צומת שאף אחד לא מצביע אליו
  const allNodeIds = new Set(nodes.map(n => n.id));
  const targetIds = new Set(edges.map(e => e.target));
  for (const id of allNodeIds) {
    if (!targetIds.has(id)) return id;
  }
  
  return nodes.length > 0 ? nodes[0].id : null;
}

// פונקציית עזר לבניית עץ היררכי מורחב
function buildHierarchy(nodes: Node[], edges: Edge[]) {
  // מיפוי צמתים לפי ID
  const nodeMap: Record<string, Node> = Object.fromEntries(nodes.map(n => [n.id, n]));
  
  // מיפוי ילדים וקשתות יורדות לכל צומת
  const childrenMap: Record<string, string[]> = {};
  const edgesBySource: Record<string, Edge[]> = {};
  
  // איתחול מבני הנתונים
  nodes.forEach(n => { 
    childrenMap[n.id] = []; 
    edgesBySource[n.id] = [];
  });
  
  // בניית מפות הקשרים
  edges.forEach(e => {
    if (childrenMap[e.source]) {
      childrenMap[e.source].push(e.target);
      edgesBySource[e.source].push(e);
    }
  });
  
  // חישוב רמות עומק לכל צומת
  const levels: Record<string, number> = {};
  const rootId = getRootNodeId(nodes, edges);
  
  function assignLevels(nodeId: string, level: number) {
    if (levels[nodeId] !== undefined && levels[nodeId] <= level) return;
    levels[nodeId] = level;
    for (const childId of childrenMap[nodeId]) {
      // קפיצת רמה לילדים של צומת אפשרויות
      const parentType = nodeMap[nodeId]?.type;
      const extraDepth = parentType === 'options' ? 1 : 0;
      assignLevels(childId, level + 1 + extraDepth);
    }
  }
  
  if (rootId) {
    assignLevels(rootId, 0);
    
    // טיפול במקרים של מספר צמתי התחלה או צמתים מנותקים
    nodes.forEach(node => {
      if (!levels[node.id]) {
        assignLevels(node.id, 0);
      }
    });
  }
  
  return { 
    nodeMap, 
    childrenMap, 
    edgesBySource, 
    levels, 
    rootId 
  };
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
) {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  // בניית עץ היררכי מורחב
  const { nodeMap, childrenMap, edgesBySource, levels, rootId } = buildHierarchy(nodes, edges);
  
  // סידור פשוט יותר - שכבות
  const positions: Record<string, { x: number; y: number }> = {};
  const usedPositions: {x: number, y: number}[] = [];
  
  // קיבוץ nodes לפי level
  const levelsArr: string[][] = [];
  Object.entries(levels).forEach(([id, lvl]) => {
    if (!levelsArr[lvl]) levelsArr[lvl] = [];
    levelsArr[lvl].push(id);
  });

  // סידור כל רמה בנפרד
  for (let lvl = 0; lvl < levelsArr.length; lvl++) {
    const ids = levelsArr[lvl];
    if (!ids || ids.length === 0) continue;
    
    // מיון הצמתים ברמה
    const sortedIds = ids.sort((a, b) => {
      const priorityOrder = [
        'intro', 'main_menu', 'start_booking_flow', 'ask_name', 'ask_name_again', 'confirm_full_name',
        'ask_city', 'ask_vehicle', 'show_available_months', 'show_available_weeks',
        'show_available_days', 'show_available_times', 'final_confirmation',
        'faq1', 'faq2', 'human_support', 'remove_candidate', 'not_suitable'
      ];
      
      const priorityA = priorityOrder.indexOf(a);
      const priorityB = priorityOrder.indexOf(b);
      
      if (priorityA !== -1 && priorityB !== -1) {
        return priorityA - priorityB;
      }
      if (priorityA !== -1) return -1;
      if (priorityB !== -1) return 1;
      
      return a.localeCompare(b);
    });
    
    // חישוב מיקומים
    const spacing = NODE_DIMENSIONS.width + NODE_DIMENSIONS.spacingX + 80;
    const totalWidth = (sortedIds.length - 1) * spacing;
    const startX = -totalWidth / 2;
    const y = lvl * (NODE_DIMENSIONS.height + NODE_DIMENSIONS.spacingY + 120);
    
    sortedIds.forEach((nodeId, index) => {
      const x = startX + (index * spacing);
      
      // בדיקה לחפיפה
      let finalPos = { x, y };
      let attempts = 0;
      while (attempts < 5) {
        let hasOverlap = false;
        for (const usedPos of usedPositions) {
          if (checkNodeOverlap(finalPos, usedPos)) {
            hasOverlap = true;
            break;
          }
        }
        
        if (!hasOverlap) break;
        
        finalPos = {
          x: x + (attempts * 30) * (index % 2 === 0 ? 1 : -1),
          y: y + (attempts * 15)
        };
        attempts++;
      }
      
      positions[nodeId] = finalPos;
      usedPositions.push(finalPos);
    });
  }
  
  // טיפול בצמתים שלא חוברו (אם יש)
  nodes.forEach(node => {
    if (!positions[node.id]) {
      const freePos = findFreeNodePosition(usedPositions, { x: 0, y: 0 });
      positions[node.id] = freePos;
      usedPositions.push(freePos);
    }
  });

  // עדכון nodes עם מיקום
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

  return { nodes: layoutedNodes, edges };
} 