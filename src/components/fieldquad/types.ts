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
  // For bbox: [ {x: minX, y: minY}, {x: maxX, y: maxY} ]
  // For polygon/freehand: array of points [{x,y}, {x,y}, ...]
  points: Point[]; 
}

export interface ImageDimensions {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}
