

export type AnnotationTool = 'select' | 'bbox' | 'polygon' | 'freehand' | 'pan'; // Added 'pan'

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
  type: Exclude<AnnotationTool, 'select' | 'pan'>; // Exclude 'pan' here too
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
  type: Exclude<AnnotationTool, 'select' | 'pan'>; // Exclude 'pan'
  points: Point[];
}

export type ExportFormat = 'original' | 'normalized';

export type CoordinateExportType = 
  | 'txt_original' 
  | 'txt_normalized' 
  | 'json_original' 
  | 'json_normalized';

export type CoverageExportFormat = 'json' | 'txt' | 'csv'; // Changed 'xlsx' to 'csv' for simplicity

// Represents the state for a single image within a batch
export interface ImageState {
  id: string; // Unique identifier for the image within the batch (e.g., filename or UUID)
  file: File;
  src: string;
  dimensions: ImageDimensions | null;
  annotations: Annotation[];
}
    
