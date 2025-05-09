
export type AnnotationTool = 'select' | 'bbox' | 'polygon' | 'freehand';

export interface Point {
  x: number;
  y: number;
}

export interface AnnotationClass {
  id: string; // UUID
  name: string;
  color: string; // hex color string for display
}

export interface Annotation {
  id: string; // UUID
  classId: string; // Corresponds to AnnotationClass.id
  type: Exclude<AnnotationTool, 'select'>;
  // For bbox: [ {x: minX, y: minY}, {x: maxX, y: maxY} ] or two corner points
  // For polygon/freehand: array of points [{x,y}, {x,y}, ...]
  points: Point[]; 
}

export interface ImageDimensions {
  width: number; // display width
  height: number; // display height
  naturalWidth: number; // original image width
  naturalHeight: number; // original image height
}

// Data structure for a shape that has been drawn but not yet assigned a class
export interface ShapeData {
  type: Exclude<AnnotationTool, 'select'>;
  points: Point[];
}
