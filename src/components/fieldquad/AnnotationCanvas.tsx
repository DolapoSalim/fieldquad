
"use client";

import type React from 'react';
import { useRef, useEffect, useState, useCallback } from 'react';
import type { Point, Annotation, AnnotationTool, AnnotationClass, ImageDimensions, ShapeData } from './types';
import { useToast } from "@/hooks/use-toast";

interface AnnotationCanvasProps {
  imageSrc: string | null;
  imageDimensions: ImageDimensions | null;
  annotations: Annotation[];
  currentTool: AnnotationTool;
  annotationClasses: AnnotationClass[];
  onShapeDrawn: (shape: ShapeData) => void;
  onAnnotationsChange: (annotations: Annotation[]) => void;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
}

const TEMP_DRAW_COLOR = '#008080'; 
const TEMP_DRAW_FILL_COLOR = `${TEMP_DRAW_COLOR}33`;
const ANNOTATION_LINE_WIDTH = 3;
const SELECTED_ANNOTATION_LINE_WIDTH = 5;
const SELECTED_ANNOTATION_COLOR = '#FF8C00'; // DarkOrange for selection highlight
const HANDLE_SIZE = 8; // For resize/move handles (visual only for now)

export function AnnotationCanvas({
  imageSrc,
  imageDimensions,
  annotations,
  currentTool,
  annotationClasses,
  onShapeDrawn,
  onAnnotationsChange,
  selectedAnnotationId,
  onSelectAnnotation,
}: AnnotationCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false); // For new shapes
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [dragStartOffset, setDragStartOffset] = useState<Point | null>(null); // Offset from annotation origin to mouse click

  const { toast } = useToast();

  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas?.getContext('2d') || null;
  }, []);

  const getMousePos = useCallback((event: React.MouseEvent<HTMLCanvasElement> | MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx || !imageSrc || !imageDimensions) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawAnnotations(ctx);
      if (isDrawing && currentPoints.length > 0 && currentTool !== 'select') {
        drawTemporaryShape(ctx, currentPoints, startPoint);
      }
    };
    img.onerror = () => {
       // Image might not be loaded yet, or path is invalid. Silently fail or toast.
       // For this redraw, if image isn't ready, it might just draw annotations on blank.
    }
    // If image is already loaded and cached by browser, onload might not fire if src is set repeatedly.
    // A better approach is to load image once and keep the Image object.
    // For now, if img.complete, draw immediately.
    if (img.complete && img.naturalHeight !== 0) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawAnnotations(ctx);
        if (isDrawing && currentPoints.length > 0 && currentTool !== 'select' && startPoint) {
            // This part is tricky, as currentPoints for drawing is different from actual annotations
            // The temporary shape drawing logic is mostly within handleMouseMove for drawing tools
        }
    }


  }, [imageSrc, imageDimensions, annotations, annotationClasses, selectedAnnotationId, getCanvasContext, isDrawing, currentPoints, startPoint, currentTool]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageDimensions) return;
    canvas.width = imageDimensions.naturalWidth;
    canvas.height = imageDimensions.naturalHeight;
    redrawCanvas();
  }, [imageSrc, imageDimensions, annotations, selectedAnnotationId, redrawCanvas]);


  const isPointInsideAnnotationPath = (ctx: CanvasRenderingContext2D, point: Point, annotation: Annotation): boolean => {
    ctx.beginPath();
    if (annotation.type === 'bbox' && annotation.points.length === 2) {
      const [p1, p2] = annotation.points;
      const minX = Math.min(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const width = Math.abs(p1.x - p2.x);
      const height = Math.abs(p1.y - p2.y);
      ctx.rect(minX, minY, width, height);
    } else if ((annotation.type === 'polygon' || annotation.type === 'freehand') && annotation.points.length > 1) {
      ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
      for (let i = 1; i < annotation.points.length; i++) {
        ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
      }
      if (annotation.type === 'polygon' && annotation.points.length > 2) {
        ctx.closePath();
      }
    } else {
      return false;
    }
    return ctx.isPointInPath(point.x, point.y);
  };

  const drawAnnotations = (ctx: CanvasRenderingContext2D) => {
    annotations.forEach(ann => {
      const annClass = annotationClasses.find(ac => ac.id === ann.classId);
      const isSelected = ann.id === selectedAnnotationId;
      
      ctx.strokeStyle = isSelected ? SELECTED_ANNOTATION_COLOR : (annClass?.color || TEMP_DRAW_COLOR);
      ctx.fillStyle = annClass ? `${annClass.color}55` : `${TEMP_DRAW_FILL_COLOR}55`;
      if (isSelected) {
        ctx.fillStyle = `${SELECTED_ANNOTATION_COLOR}55`; // More prominent fill for selected
      }
      ctx.lineWidth = isSelected ? SELECTED_ANNOTATION_LINE_WIDTH : ANNOTATION_LINE_WIDTH;
      
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
            ctx.fillStyle = isSelected? SELECTED_ANNOTATION_COLOR : annClass.color;
            ctx.font = `bold ${isSelected ? 14 : 12}px Arial`; 
            ctx.fillText(annClass.name, minX + 5, minY + (isSelected ? 16 : 14));
        }
      } else if ((ann.type === 'polygon' || ann.type === 'freehand') && ann.points.length > 1) {
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x, ann.points[i].y);
        }
        if (ann.type === 'polygon' && ann.points.length > 2) ctx.closePath();
        ctx.stroke();
        if (ann.points.length > 2 || (ann.type === 'polygon' && ann.points.length > 2)) ctx.fill();
        
        if (annClass && ann.points.length > 0) {
            ctx.fillStyle = isSelected? SELECTED_ANNOTATION_COLOR : annClass.color;
            ctx.font = `bold ${isSelected ? 14 : 12}px Arial`; 
            ctx.fillText(annClass.name, ann.points[0].x + 5, ann.points[0].y - (isSelected ? 7 : 5));
        }
      }

      // Draw handles if selected (visual only for now for polygons/freehand, bbox handles could be for resize later)
      if (isSelected) {
        ctx.fillStyle = SELECTED_ANNOTATION_COLOR;
        ann.points.forEach(p => {
          ctx.fillRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        });
        if (ann.type === 'bbox' && ann.points.length === 2) {
            const [p1, p2] = ann.points;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const pointsForHandles = [p1, p2, {x: p1.x, y:p2.y}, {x:p2.x, y:p1.y}, {x:p1.x, y:midY}, {x:p2.x, y:midY}, {x:midX, y:p1.y}, {x:midX, y:p2.y}];
            pointsForHandles.forEach(p => {
                 ctx.fillRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
            });
        }
      }
    });
  };

  const drawTemporaryShape = (ctx: CanvasRenderingContext2D, points: Point[], initialStartPoint: Point | null) => {
    if (!initialStartPoint) return;
    ctx.strokeStyle = TEMP_DRAW_COLOR;
    ctx.fillStyle = TEMP_DRAW_FILL_COLOR;
    ctx.lineWidth = ANNOTATION_LINE_WIDTH;
    ctx.beginPath();

    if (currentTool === 'bbox') {
      if (points.length < 1) return; // Need current mouse pos as second point
      const currentPos = points[points.length-1];
      const minX = Math.min(initialStartPoint.x, currentPos.x);
      const minY = Math.min(initialStartPoint.y, currentPos.y);
      const width = Math.abs(initialStartPoint.x - currentPos.x);
      const height = Math.abs(initialStartPoint.y - currentPos.y);
      ctx.rect(minX, minY, width, height);
      ctx.stroke();
      ctx.fill();
    } else if (currentTool === 'freehand' && points.length > 0) {
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    } else if (currentTool === 'polygon' && points.length > 0) {
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        // line to current mouse position if drawing is active
        if (isDrawing && points.length > 0 && points[points.length-1] !== initialStartPoint) { // Check if points is not empty and last point is not the start point
            // This logic is flawed, mousemove should handle live preview
        }
        ctx.stroke();
    }
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageSrc || !imageDimensions) return;
    const ctx = getCanvasContext();
    if (!ctx) return;

    const pos = getMousePos(event);

    if (currentTool === 'select') {
      let clickedAnnotation: Annotation | null = null;
      // Iterate in reverse to select top-most annotation
      for (let i = annotations.length - 1; i >= 0; i--) {
        if (isPointInsideAnnotationPath(ctx, pos, annotations[i])) {
          clickedAnnotation = annotations[i];
          break;
        }
      }

      if (clickedAnnotation) {
        onSelectAnnotation(clickedAnnotation.id);
        setIsDraggingAnnotation(true);
        // Calculate offset from the first point of the annotation to the mouse click
        const offsetX = pos.x - clickedAnnotation.points[0].x;
        const offsetY = pos.y - clickedAnnotation.points[0].y;
        setDragStartOffset({ x: offsetX, y: offsetY });

      } else {
        onSelectAnnotation(null);
        setIsDraggingAnnotation(false);
      }
      setIsDrawing(false); // Not drawing a new shape
      setCurrentPoints([]);
      setStartPoint(null);

    } else { // Drawing tools
      onSelectAnnotation(null); // Deselect if drawing
      setIsDrawing(true);
      setStartPoint(pos);
      if (currentTool === 'polygon') {
          setCurrentPoints(prev => [...prev, pos]);
      } else if (currentTool === 'freehand' || currentTool === 'bbox') { // Bbox starts with startPoint, adds current mouse on move
          setCurrentPoints([pos]);
      }
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageSrc || !imageDimensions) return;
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx) return;

    const pos = getMousePos(event);

    if (isDraggingAnnotation && selectedAnnotationId && dragStartOffset) {
      const draggedAnnotation = annotations.find(ann => ann.id === selectedAnnotationId);
      if (!draggedAnnotation) return;

      const newPoints = draggedAnnotation.points.map((p, index) => {
          if (index === 0) { // Drag based on the offset from the first point
            return {
                x: pos.x - dragStartOffset.x,
                y: pos.y - dragStartOffset.y
            };
          }
          // For other points, maintain relative position to the first point
          const relativeX = p.x - draggedAnnotation.points[0].x;
          const relativeY = p.y - draggedAnnotation.points[0].y;
          return {
            x: (pos.x - dragStartOffset.x) + relativeX,
            y: (pos.y - dragStartOffset.y) + relativeY
          };
      });
      
      const updatedAnnotations = annotations.map(ann => 
        ann.id === selectedAnnotationId ? { ...ann, points: newPoints } : ann
      );
      onAnnotationsChange(updatedAnnotations);
      // Redraw will be triggered by useEffect on annotations change

    } else if (isDrawing && startPoint && currentTool !== 'select') {
        const img = new Image(); // TODO: Optimize image loading - don't reload on every mouse move
        img.src = imageSrc;
        
        // This redraw logic in mouseMove for drawing tools should be efficient
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawAnnotations(ctx); // Draw existing annotations first

        ctx.strokeStyle = TEMP_DRAW_COLOR;
        ctx.fillStyle = TEMP_DRAW_FILL_COLOR;
        ctx.lineWidth = ANNOTATION_LINE_WIDTH;
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
            const tempCurrentPoints = [...currentPoints, pos]; 
            if (tempCurrentPoints.length > 0) {
                ctx.moveTo(tempCurrentPoints[0].x, tempCurrentPoints[0].y);
                tempCurrentPoints.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
            }
        } else if (currentTool === 'polygon') {
            if (currentPoints.length > 0) {
                ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
                currentPoints.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.lineTo(pos.x, pos.y); 
                ctx.stroke();
            }
        }
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingAnnotation) {
      setIsDraggingAnnotation(false);
      setDragStartOffset(null);
      // Final state of annotation is already set by onAnnotationsChange in mouseMove
      return;
    }

    if (!isDrawing || !startPoint || currentTool === 'select' || !imageSrc) return;
    
    const pos = getMousePos(event);
    let newShape: ShapeData | null = null;
    let finalPoints = [...currentPoints]; // For freehand and polygon (intermediate)

    if (currentTool === 'bbox') {
      if (Math.abs(startPoint.x - pos.x) > ANNOTATION_LINE_WIDTH && Math.abs(startPoint.y - pos.y) > ANNOTATION_LINE_WIDTH) {
        newShape = { type: 'bbox', points: [startPoint, pos] };
      } else {
        toast({ title: "Shape Too Small", description: "Bounding box is too small.", variant: "default" });
      }
    } else if (currentTool === 'freehand') {
        finalPoints = [...currentPoints, pos]; // Add last point on mouseUp
        if (finalPoints.length > 1) {
          newShape = { type: 'freehand', points: finalPoints };
        } else {
          toast({ title: "Shape Too Small", description: "Freehand shape needs more points.", variant: "default" });
        }
    } // Polygon point addition happens on MouseDown, completion on DoubleClick

    if (newShape) {
      onShapeDrawn(newShape);
    }
    
    if (currentTool !== 'polygon') { 
        setIsDrawing(false);
        setStartPoint(null);
        setCurrentPoints([]);
    } else {
      // For polygon, mouseUp might not end drawing if it's adding a point.
      // MouseDown adds point, mouseUp for polygon might not do anything specific unless it's the final point
      // (which is handled by double click). So setIsDrawing(false) here might be too early for polygon drag-to-place-point.
      // For click-to-place points, MouseDown sets point, MouseUp is irrelevant for polygon point adding.
      // The existing logic in MouseDown adds point to currentPoints for polygon.
      // Let's keep isDrawing true for polygon until double click.
      // However, if mouse is simply released without moving (after a mousedown that added a point), state should be fine.
      // To allow next click to add a new point, isDrawing should be effectively false after this click.
      // The current logic is: mousedown sets a point. If it's mouseup now, that point is set.
      // The `isDrawing` state is more for continuous drawing like bbox/freehand.
      // Let's reset `isDrawing` if it's not a drag for polygon.
      // No, polygon points are added on MOUSE DOWN. So MouseUp is not for adding polygon points.
      // MouseUp for polygon should not clear points, it's just the end of a potential drag for a point (if we implement that)
      // Since we are doing click-to-add, isDrawing should remain true for Polygon until double click.
      // No, isDrawing can be false. The currentPoints.length > 0 indicates polygon drawing is in progress.
       setIsDrawing(false); 
       // startPoint remains the first point of polygon.
    }
  };
  
  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'polygon' && currentPoints.length > 2) {
        const newShape: ShapeData = { type: 'polygon', points: [...currentPoints] };
        onShapeDrawn(newShape);
        setCurrentPoints([]);
        setIsDrawing(false); 
        setStartPoint(null);
    } else if (currentTool === 'polygon' && currentPoints.length <= 2) {
        toast({ title: "Polygon Too Small", description: "A polygon needs at least 3 points. Discarded current points.", variant: "default" });
        setCurrentPoints([]); 
        setIsDrawing(false);
        setStartPoint(null);
    }
  };


  if (!imageSrc) {
    return (
      <div className="flex items-center justify-center h-full border-2 border-dashed border-muted-foreground/50 rounded-lg bg-muted/20 p-8">
        <p className="text-muted-foreground">Upload an image to begin annotation.</p>
      </div>
    );
  }
  
  return (
    <div 
      className="w-full h-full bg-muted/10 rounded-md shadow-inner relative flex items-center justify-center overflow-hidden"
      data-ai-hint="annotation canvas container"
      tabIndex={0} // Make div focusable for keyboard events, though listener is on document
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className={`cursor-${currentTool === 'select' && selectedAnnotationId ? 'move' : currentTool === 'select' ? 'default' : 'crosshair'}`}
        style={{
          display: 'block', 
          maxWidth: '100%',  
          maxHeight: '100%', 
          objectFit: 'contain', 
        }}
        data-ai-hint="annotation area"
      />
    </div>
  );
}

    
