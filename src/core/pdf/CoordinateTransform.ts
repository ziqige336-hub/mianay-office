/**
 * CoordinateTransform.ts
 * Rigorous 2D geometric and coordinate transformation engine for PDF Canvas Stage.
 *
 * Provides bidirectional mapping between:
 * 1. Screen / Stage CSS Pixels
 * 2. Page Canvas Percentage Coordinates (0-100%)
 * 3. Native PDF Points (72 DPI, origin at bottom-left)
 *
 * Also handles:
 * - Page rotation (0°, 90°, 180°, 270°) and dimension transposition
 * - Object rotation, trigonometric angle calculations, and snapping
 * - 8-direction resize calculations with aspect-ratio preservation
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayPageDimensions {
  displayWidth: number;
  displayHeight: number;
  isSideways: boolean;
}

/**
 * Calculates display dimensions of a page considering rotation and zoom.
 * When rotation is 90° or 270°, the width and height transpose.
 */
export function getDisplayPageDimensions(
  pageWidth: number,
  pageHeight: number,
  rotation: number = 0,
  zoom: number = 1.0
): DisplayPageDimensions {
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const isSideways = normalizedRotation === 90 || normalizedRotation === 270;

  const baseWidth = isSideways ? pageHeight : pageWidth;
  const baseHeight = isSideways ? pageWidth : pageHeight;

  return {
    displayWidth: Math.round(baseWidth * zoom * 100) / 100,
    displayHeight: Math.round(baseHeight * zoom * 100) / 100,
    isSideways,
  };
}

/**
 * Converts mouse delta in screen pixels to percentage change on the display canvas.
 */
export function screenDeltaToPagePercent(
  deltaScreenX: number,
  deltaScreenY: number,
  displayWidth: number,
  displayHeight: number
): { deltaXPct: number; deltaYPct: number } {
  if (displayWidth <= 0 || displayHeight <= 0) {
    return { deltaXPct: 0, deltaYPct: 0 };
  }
  return {
    deltaXPct: (deltaScreenX / displayWidth) * 100,
    deltaYPct: (deltaScreenY / displayHeight) * 100,
  };
}

/**
 * Converts screen mouse position to percentage coordinates (0-100%) inside the page container.
 */
export function screenPointToPagePercent(
  screenX: number,
  screenY: number,
  containerRect: DOMRect
): Point {
  if (containerRect.width <= 0 || containerRect.height <= 0) {
    return { x: 0, y: 0 };
  }
  const x = ((screenX - containerRect.left) / containerRect.width) * 100;
  const y = ((screenY - containerRect.top) / containerRect.height) * 100;
  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
  };
}

/**
 * Calculates rotation angle in degrees from center point to mouse position.
 * Includes optional shift-key snap (15-degree increments) and soft cardinal snapping (0, 90, 180, 270).
 */
export function calculateRotationAngle(
  centerX: number,
  centerY: number,
  mouseX: number,
  mouseY: number,
  initialAngleOffset: number = 0,
  shiftKey: boolean = false
): number {
  const radian = Math.atan2(mouseY - centerY, mouseX - centerX);
  let degree = (radian * 180) / Math.PI;

  let totalDegree = (degree - initialAngleOffset) % 360;
  if (totalDegree < 0) totalDegree += 360;

  if (shiftKey) {
    totalDegree = Math.round(totalDegree / 15) * 15;
  } else {
    // Soft snap to 0, 90, 180, 270 within 3.5 degrees
    const snaps = [0, 90, 180, 270, 360];
    for (const snap of snaps) {
      if (Math.abs(totalDegree - snap) <= 3.5) {
        totalDegree = snap % 360;
        break;
      }
    }
  }

  return Math.round(totalDegree);
}

/**
 * Rotates a 2D point around a specified origin by an angle in degrees.
 */
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number
): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const dx = px - cx;
  const dy = py - cy;

  return {
    x: cx + (dx * cos - dy * sin),
    y: cy + (dx * sin + dy * cos),
  };
}

/**
 * Calculates updated bounding box during 8-direction resize.
 * Handles minimum dimensions, edge clamps, and optional aspect ratio locking.
 */
export function calculateResize(
  handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w',
  startRect: Rect,
  deltaXPct: number,
  deltaYPct: number,
  options: {
    minWidth?: number;
    minHeight?: number;
    lockAspectRatio?: boolean;
  } = {}
): Rect {
  const minW = options.minWidth ?? 2;
  const minH = options.minHeight ?? 2;
  const lockAspectRatio = Boolean(options.lockAspectRatio);

  let newX = startRect.x;
  let newY = startRect.y;
  let newW = startRect.width;
  let newH = startRect.height;

  const aspectRatio = startRect.width / Math.max(0.1, startRect.height);

  if (handle.includes('e')) {
    newW = Math.max(minW, startRect.width + deltaXPct);
  }
  if (handle.includes('s')) {
    newH = Math.max(minH, startRect.height + deltaYPct);
  }
  if (handle.includes('w')) {
    const candidateW = startRect.width - deltaXPct;
    if (candidateW >= minW) {
      newW = candidateW;
      newX = startRect.x + deltaXPct;
    }
  }
  if (handle.includes('n')) {
    const candidateH = startRect.height - deltaYPct;
    if (candidateH >= minH) {
      newH = candidateH;
      newY = startRect.y + deltaYPct;
    }
  }

  // Preserve aspect ratio if requested
  if (lockAspectRatio && (handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw')) {
    if (Math.abs(deltaXPct) > Math.abs(deltaYPct)) {
      newH = newW / aspectRatio;
      if (handle.includes('n')) {
        newY = startRect.y + (startRect.height - newH);
      }
    } else {
      newW = newH * aspectRatio;
      if (handle.includes('w')) {
        newX = startRect.x + (startRect.width - newW);
      }
    }
  }

  return {
    x: Math.round(newX * 10) / 10,
    y: Math.round(newY * 10) / 10,
    width: Math.round(newW * 10) / 10,
    height: Math.round(newH * 10) / 10,
  };
}

/**
 * Maps display percentage coordinates (where (0,0) is top-left of displayed canvas)
 * to native PDF point coordinates (where (0,0) is bottom-left of original unrotated PDF page).
 */
export function displayPctToPdfPoints(
  pct: Point,
  originalPageWidthPt: number,
  originalPageHeightPt: number,
  pageRotationDeg: number = 0
): Point {
  const normRot = ((pageRotationDeg % 360) + 360) % 360;

  // Normalized (0..1) coordinates in the display viewport
  const u = pct.x / 100;
  const v = pct.y / 100;

  switch (normRot) {
    case 90:
      // In 90° clockwise display:
      // display width corresponds to original height
      // display height corresponds to original width
      // Display top-left is PDF (0, height)
      return {
        x: (1 - v) * originalPageWidthPt,
        y: (1 - u) * originalPageHeightPt,
      };

    case 180:
      return {
        x: (1 - u) * originalPageWidthPt,
        y: v * originalPageHeightPt,
      };

    case 270:
      return {
        x: v * originalPageWidthPt,
        y: u * originalPageHeightPt,
      };

    case 0:
    default:
      return {
        x: u * originalPageWidthPt,
        y: (1 - v) * originalPageHeightPt, // Invert Y because PDF origin is bottom-left
      };
  }
}
