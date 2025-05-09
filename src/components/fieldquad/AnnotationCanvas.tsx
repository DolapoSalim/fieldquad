"use client";

import type React from 'react';
import { useRef, useEffect, useState } from 'react';
import type { Point, Annotation, AnnotationTool, AnnotationClass, ImageDimensions } from './types';
import { useToast } from "@/hooks/use-toast";

interface AnnotationCanvasProps {
  imageSrc: string | null;
  imageDimensions: ImageDimensions | null;
  annotations: Annotation[];
  currentTool: AnnotationTool;
  selectedClassId: string | null;
  annotationClasses: AnnotationClass[];
  onAnnotationAdd: (annotation: Annotation) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void; // For future use (move/resize)
  onAnnotationsChange: (annotations: Annotation[]) => void;
}

// Helper to generate distinct colors
const PREDEFINED_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#2AB7CA', 
  '#F0B67F', '#FE5F55', '#D65DB1', '#845EC2', '#008F7A'
];

export function AnnotationCanvas({
  imageSrc,
  imageDimensions,
  annotations,
  currentTool,
  selectedClassId,
  annotationClasses,
  onAnnotationAdd,
  onAnnotationsChange
}: AnnotationCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]); // For polygon/freehand
  const { toast } = useToast();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc || !imageDimensions) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    // For simplicity, display image at natural size. If scaling is needed, this needs adjustment.
    canvas.width = imageDimensions.naturalWidth;
    canvas.height = imageDimensions.naturalHeight;
    
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawAnnotations(ctx);
    };
    img.onerror = () => {
      toast({ title: "Error loading image", description: "Could not load the image onto the canvas.", variant: "destructive" });
    }

  }, [imageSrc, imageDimensions, annotations]);


  const getMousePos = (event: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Adjust for potential CSS scaling of the canvas if its display size differs from its drawing surface size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const drawAnnotations = (ctx: CanvasRenderingContext2D) => {
    annotations.forEach(ann => {
      const annClass = annotationClasses.find(ac => ac.id === ann.classId);
      ctx.strokeStyle = annClass?.color || PREDEFINED_COLORS[0];
      ctx.fillStyle = annClass ? `${annClass.color}33` : `${PREDEFINED_COLORS[0]}33`; // semi-transparent fill
      ctx.lineWidth = 2;
      ctx.beginPath();

      if (ann.type === 'bbox' && ann.points.length === 2) {
        const [p1, p2] = ann.points;
        const minX = Math.min(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const width = Math.abs(p1.x - p2.x);
        const height = Math.abs(p1.y - p2.y);
        ctx.rect(minX, minY, width, height);
        ctx.stroke();
        ctx.fill();
        if (annClass) {
            ctx.fillStyle = annClass.color;
            ctx.font = "12px Arial";
            ctx.fillText(annClass.name, minX + 2, minY + 12 > minY + height ? minY +12 : minY + 12);
        }
      } else if ((ann.type === 'polygon' || ann.type === 'freehand') && ann.points.length > 1) {
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x, ann.points[i].y);
        }
        if (ann.type === 'polygon') {
          ctx.closePath();
        }
        ctx.stroke();
        if (ann.type === 'polygon') ctx.fill();
         if (annClass && ann.points.length > 0) {
            ctx.fillStyle = annClass.color;
            ctx.font = "12px Arial";
            ctx.fillText(annClass.name, ann.points[0].x + 2, ann.points[0].y - 5 < 0 ? ann.points[0].y + 12 : ann.points[0].y -5);
        }
      }
    });
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedClassId) {
      toast({ title: "No class selected", description: "Please select or create an annotation class first.", variant: "destructive" });
      return;
    }
    if (currentTool === 'select' || !imageSrc) return;

    const pos = getMousePos(event);
    setIsDrawing(true);
    setStartPoint(pos);
    if (currentTool === 'polygon') {
        setCurrentPoints(prev => [...prev, pos]);
    } else if (currentTool === 'freehand') {
        setCurrentPoints([pos]);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || currentTool === 'select' || !imageSrc) return;

    const canvas = canvasRef.current;
    if (!canvas || !imageDimensions) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getMousePos(event);

    // Redraw image and existing annotations
    const img = new Image();
    img.src = imageSrc; // Assuming imageSrc is always valid here
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawAnnotations(ctx);
    
    // Draw current annotation being created
    const currentAnnClass = annotationClasses.find(ac => ac.id === selectedClassId);
    ctx.strokeStyle = currentAnnClass?.color || PREDEFINED_COLORS[0];
    ctx.fillStyle = currentAnnClass ? `${currentAnnClass.color}33` : `${PREDEFINED_COLORS[0]}33`;
    ctx.lineWidth = 2;
    ctx.beginPath();

    if (currentTool === 'bbox') {
      const minX = Math.min(startPoint.x, pos.x);
      const minY = Math.min(startPoint.y, pos.y);
      const width = Math.abs(startPoint.x - pos.x);
      const height = Math.abs(startPoint.y - pos.y);
      ctx.rect(minX, minY, width, height);
      ctx.stroke();
      ctx.fill();
    } else if (currentTool === 'freehand') {
        setCurrentPoints(prev => [...prev, pos]);
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        currentPoints.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    } else if (currentTool === 'polygon') {
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        currentPoints.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(pos.x, pos.y); // Line to current mouse position
        ctx.stroke();
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || currentTool === 'select' || !selectedClassId || !imageSrc) return;
    
    const pos = getMousePos(event);
    let newAnnotation: Annotation | null = null;

    if (currentTool === 'bbox') {
      newAnnotation = {
        id: crypto.randomUUID(),
        classId: selectedClassId,
        type: 'bbox',
        points: [startPoint, pos],
      };
    } else if (currentTool === 'freehand') {
        newAnnotation = {
            id: crypto.randomUUID(),
            classId: selectedClassId,
            type: 'freehand',
            points: [...currentPoints, pos],
        };
    }
    // For polygon, mouse up doesn't finalize. It adds a point. Finalization is on double click or specific action.
    // For simplicity, let's not implement full polygon drawing in this iteration.
    // User can click multiple times for polygon, then maybe a button "Finish Polygon" or double click.

    if (newAnnotation) {
      onAnnotationAdd(newAnnotation);
    }
    
    if (currentTool !== 'polygon') { // Reset for tools other than polygon
        setIsDrawing(false);
        setStartPoint(null);
        setCurrentPoints([]);
    } else {
        // For polygon, mouseUp just adds a point if isDrawing is true (meaning dragging to place point)
        // If not dragging, it's a click, handled in onMouseDown.
        // This needs more refined logic for polygon completion.
        // For now, let's simplify and not support dragging for polygon points.
        setIsDrawing(false); // Reset isDrawing to allow next click to add point
    }
  };
  
  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'polygon' && currentPoints.length > 2 && selectedClassId) {
        const newAnnotation: Annotation = {
            id: crypto.randomUUID(),
            classId: selectedClassId,
            type: 'polygon',
            points: [...currentPoints],
        };
        onAnnotationAdd(newAnnotation);
        setCurrentPoints([]);
        setIsDrawing(false);
        setStartPoint(null);
        toast({ title: "Polygon created", description: `Polygon with ${newAnnotation.points.length} points added.`});
    }
  };


  if (!imageSrc) {
    return (
      <div className="flex items-center justify-center h-full border-2 border-dashed border-muted-foreground/50 rounded-lg bg-muted/20 p-8">
        <p className="text-muted-foreground">Upload an image to begin annotation.</p>
      </div>
    );
  }
  
  // Max width/height for canvas container to prevent overly large images from breaking layout
  // Actual canvas size is set to image natural dimensions for 1:1 pixel mapping.
  // Container provides scrollbars if image is larger than viewport.
  return (
    <div className="w-full h-[calc(100vh-200px)] md:h-full overflow-auto bg-muted/10 rounded-md shadow-inner relative">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className="cursor-crosshair"
        style={{ display: 'block' }} // Ensure canvas itself doesn't add extra space
        data-ai-hint="annotation area"
      />
    </div>
  );
}
