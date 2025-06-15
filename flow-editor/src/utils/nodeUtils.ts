/**
 * Utility functions for node operations in the flow editor
 */

// Standard node dimensions
export const NODE_DIMENSIONS = {
  width: 260,
  height: 120,
  spacingX: 150,
  spacingY: 150,
};

/**
 * Check if two node positions overlap
 * @param pos1 First position
 * @param pos2 Second position
 * @returns Boolean indicating if the positions overlap
 */
export function checkNodeOverlap(pos1: {x: number, y: number}, pos2: {x: number, y: number}): boolean {
  // Add padding to make sure nodes don't overlap too closely
  const xOverlap = Math.abs(pos1.x - pos2.x) < (NODE_DIMENSIONS.width + 50);
  const yOverlap = Math.abs(pos1.y - pos2.y) < (NODE_DIMENSIONS.height + 50);
  return xOverlap && yOverlap;
}

/**
 * Find a free position for a new node, avoiding existing nodes
 * @param existingPositions Array of existing node positions to avoid
 * @param initialPos Initial position to try
 * @returns A position that doesn't overlap with existing positions
 */
export function findFreeNodePosition(
  existingPositions: {x: number, y: number}[], 
  initialPos: {x: number, y: number}
): {x: number, y: number} {
  // Clone the initial position object to avoid modifying the original
  let newPos = {...initialPos};
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loops
  
  // Define different directions to try
  const directions = [
    { x: NODE_DIMENSIONS.spacingX, y: 0 },              // right
    { x: 0, y: NODE_DIMENSIONS.spacingY },              // down
    { x: -NODE_DIMENSIONS.spacingX, y: 0 },             // left
    { x: 0, y: -NODE_DIMENSIONS.spacingY },             // up
    { x: NODE_DIMENSIONS.spacingX, y: NODE_DIMENSIONS.spacingY },  // diagonal down-right
    { x: -NODE_DIMENSIONS.spacingX, y: NODE_DIMENSIONS.spacingY }, // diagonal down-left
    { x: NODE_DIMENSIONS.spacingX, y: -NODE_DIMENSIONS.spacingY }, // diagonal up-right
    { x: -NODE_DIMENSIONS.spacingX, y: -NODE_DIMENSIONS.spacingY }, // diagonal up-left
  ];
  
  while (attempts < maxAttempts) {
    let hasOverlap = false;
    
    for (const existingPos of existingPositions) {
      if (checkNodeOverlap(newPos, existingPos)) {
        hasOverlap = true;
        // Choose direction based on attempt number
        const direction = directions[attempts % directions.length];
        newPos.x += direction.x;
        newPos.y += direction.y;
        break;
      }
    }
    
    if (!hasOverlap) {
      return newPos;
    }
    
    attempts++;
  }
  
  // If no free position was found, return a position far from the initial position
  return { 
    x: initialPos.x + (NODE_DIMENSIONS.spacingX * 2), 
    y: initialPos.y + (NODE_DIMENSIONS.spacingY * 2) 
  };
} 