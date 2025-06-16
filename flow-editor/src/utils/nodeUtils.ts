/**
 * Utility functions for node operations in the flow editor
 */

// Standard node dimensions
export const NODE_DIMENSIONS = {
  width: 200,
  height: 80,
  spacingX: 120,
  spacingY: 100,
};

/**
 * Check if two node positions overlap
 * @param pos1 First position
 * @param pos2 Second position
 * @returns Boolean indicating if the positions overlap
 */
export function checkNodeOverlap(pos1: any, pos2: any): boolean {
  if (!pos1 || !pos2) return false;
  
  const threshold = NODE_DIMENSIONS.width / 2;
  
  return Math.abs(pos1.x - pos2.x) < threshold && 
         Math.abs(pos1.y - pos2.y) < threshold;
}

/**
 * Find a free position for a new node, avoiding existing nodes
 * @param usedPositions Array of existing node positions to avoid
 * @param basePosition Initial position to try
 * @returns A position that doesn't overlap with existing positions
 */
export function findFreeNodePosition(usedPositions: {x: number, y: number}[], basePosition: {x: number, y: number}): {x: number, y: number} {
  if (usedPositions.length === 0) return basePosition;
  
  if (!usedPositions.some(pos => checkNodeOverlap(pos, basePosition))) {
    return basePosition;
  }
  
  const radius = NODE_DIMENSIONS.width;
  const steps = 16;
  
  for (let r = 1; r <= 5; r++) {
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = basePosition.x + Math.cos(angle) * radius * r;
      const y = basePosition.y + Math.sin(angle) * radius * r;
      const position = { x, y };
      
      if (!usedPositions.some(pos => checkNodeOverlap(pos, position))) {
        return position;
      }
    }
  }
  
  return {
    x: basePosition.x + (Math.random() - 0.5) * NODE_DIMENSIONS.width * 3,
    y: basePosition.y + Math.random() * NODE_DIMENSIONS.height * 3
  };
} 