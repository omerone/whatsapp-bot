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
  
  // בדיקה אם כל הצמתים כבר יש להם מיקום מוגדר
  const allNodesHavePosition = nodes.every(node => 
    node.position && (node.position.x !== 0 || node.position.y !== 0)
  );

  // Even if nodes have positions, we should check for overlaps
  const positionsToCheck = nodes.map(node => node.position);
  let needsRelayout = false;
  
  // Check if any nodes are overlapping
  if (allNodesHavePosition) {
    for (let i = 0; i < positionsToCheck.length; i++) {
      for (let j = i + 1; j < positionsToCheck.length; j++) {
        if (checkNodeOverlap(positionsToCheck[i], positionsToCheck[j])) {
          needsRelayout = true;
          break;
        }
      }
      if (needsRelayout) break;
    }
  }

  // אם כל הצמתים כבר יש להם מיקום ואין חפיפות, נחזיר אותם כמו שהם
  if (allNodesHavePosition && !needsRelayout) {
    return { 
      nodes: nodes.map(node => ({
        ...node,
        targetPosition: direction === 'LR' ? 'left' : 'top',
        sourcePosition: direction === 'LR' ? 'right' : 'bottom',
      })), 
      edges 
    };
  }

  // בניית עץ היררכי מורחב
  const { nodeMap, childrenMap, edgesBySource, levels } = buildHierarchy(nodes, edges);
  
  // קיבוץ nodes לפי level
  const levelsArr: string[][] = [];
  Object.entries(levels).forEach(([id, lvl]) => {
    if (!levelsArr[lvl]) levelsArr[lvl] = [];
    levelsArr[lvl].push(id);
  });

  // חישוב X/Y לכל node: כל רמה בשורה, כל siblings בריווח שווה
  const positions: Record<string, { x: number; y: number }> = {};
  const usedPositions: {x: number, y: number}[] = [];
  
  for (let lvl = 0; lvl < levelsArr.length; lvl++) {
    const ids = levelsArr[lvl];
    if (!ids || ids.length === 0) continue;
    
    const totalWidth = (ids.length - 1) * (NODE_DIMENSIONS.width + NODE_DIMENSIONS.spacingX);
    
    for (let i = 0; i < ids.length; i++) {
      // שמירה על המיקום הקיים אם יש כזה וזה לא חופף עם אחרים
      const node = nodeMap[ids[i]];
      if (!needsRelayout && node.position && (node.position.x !== 0 || node.position.y !== 0)) {
        let canKeepPosition = true;
        
        // Check if this position overlaps with any already used positions
        for (const usedPos of usedPositions) {
          if (checkNodeOverlap(node.position, usedPos)) {
            canKeepPosition = false;
            break;
          }
        }
        
        if (canKeepPosition) {
          positions[ids[i]] = node.position;
          usedPositions.push(node.position);
          continue;
        }
      }
      
      const baseX = -totalWidth / 2 + i * (NODE_DIMENSIONS.width + NODE_DIMENSIONS.spacingX);
      let baseY = lvl * (NODE_DIMENSIONS.height + NODE_DIMENSIONS.spacingY + 50);
      
      // התאמת גובה למקרים מיוחדים
      const nodeType = node.type;
      if (nodeType === 'options') {
        baseY += 30; // מרווח נוסף לצמתי אפשרויות
      }
      
      // הוספת מעט אקראיות להימנע מקווים ישרים מדי
      const randomOffset = {
        x: Math.random() * 20 - 10, 
        y: Math.random() * 10
      };
      
      // מציאת מיקום פנוי
      const freePos = findFreeNodePosition(
        usedPositions, 
        { 
          x: baseX + randomOffset.x, 
          y: baseY + randomOffset.y 
        }
      );
      
      positions[ids[i]] = freePos;
      usedPositions.push(freePos);
    }
  }

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