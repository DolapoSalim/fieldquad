
"use client";

import type React from 'react';
import { useRef, useEffect, useState } from 'react';
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
  // selectedClassId?: string | null; // Optional: if used for highlighting existing annotations
}

const TEMP_DRAW_COLOR = '#008080'; // Teal as a default temporary drawing color
const TEMP_DRAW_FILL_COLOR = `${TEMP_DRAW_COLOR}33`; // Semi-transparent fill

export function AnnotationCanvas({
  imageSrc,
  imageDimensions,
  annotations,
  currentTool,
  annotationClasses,
  onShapeDrawn,
  onAnnotationsChange
  // selectedClassId 
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

    // Set canvas logical dimensions to natural image dimensions for accurate drawing
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

  }, [imageSrc, imageDimensions, annotations, annotationClasses, toast]);


  const getMousePos = (event: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect(); // Gets the DISPLAYED size and position
    // Scale mouse coordinates to the canvas's logical (natural) dimensions
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
      ctx.strokeStyle = annClass?.color || TEMP_DRAW_COLOR;
      ctx.fillStyle = annClass ? `${annClass.color}33` : TEMP_DRAW_FILL_COLOR;
      ctx.lineWidth = 2; // Consider scaling line width if canvas is heavily scaled down visually
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
            ctx.fillStyle = annClass.color; // For text, use solid color
            ctx.font = "bold 12px Arial"; // Consider scaling font size
            ctx.fillText(annClass.name, minX + 3, minY + 14 > minY + height ? minY + 14 : minY + 14);
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
            ctx.fillStyle = annClass.color; // For text, use solid color
            ctx.font = "bold 12px Arial"; // Consider scaling font size
            ctx.fillText(annClass.name, ann.points[0].x + 3, ann.points[0].y - 5 < 0 ? ann.points[0].y + 14 : ann.points[0].y - 5);
        }
      }
    });
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
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

    const img = new Image();
    img.src = imageSrc; 
    // Redraw image and existing annotations before drawing temporary shape
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawAnnotations(ctx);
    
    ctx.strokeStyle = TEMP_DRAW_COLOR;
    ctx.fillStyle = TEMP_DRAW_FILL_COLOR;
    ctx.lineWidth = 2; // Consider scaling
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
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || currentTool === 'select' || !imageSrc) return;
    
    const pos = getMousePos(event);
    let newShape: ShapeData | null = null;

    if (currentTool === 'bbox') {
      newShape = {
        type: 'bbox',
        points: [startPoint, pos],
      };
    } else if (currentTool === 'freehand') {
        newShape = {
            type: 'freehand',
            points: [...currentPoints, pos], 
        };
    }

    if (newShape) {
      onShapeDrawn(newShape);
    }
    
    if (currentTool !== 'polygon') { 
        setIsDrawing(false);
        setStartPoint(null);
        setCurrentPoints([]);
    } else {
      setIsDrawing(false); // For polygon, mouseUp adds a point if not dragging, or finishes drag for a point. Double click finalizes.
    }
  };
  
  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'polygon' && currentPoints.length > 2) { // Min 3 points for a polygon
        const newShape: ShapeData = {
            type: 'polygon',
            points: [...currentPoints], 
        };
        onShapeDrawn(newShape);
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
  
  // Parent div controls the visual box for the canvas.
  // Canvas itself is scaled using CSS maxWidth/maxHeight while its attributes (width/height)
  // remain image's natural dimensions for correct coordinate system.
  return (
    <div className="w-full h-[calc(100vh-200px)] md:h-full bg-muted/10 rounded-md shadow-inner relative flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className="cursor-crosshair"
        style={{
          display: 'block', // Important for layout and scaling
          maxWidth: '100%',  // Scale down to fit parent width
          maxHeight: '100%', // Scale down to fit parent height
          // width: 'auto', // Browser will maintain aspect ratio based on intrinsic (attribute) dimensions
          // height: 'auto', // and max-width/max-height constraints
        }}
        data-ai-hint="annotation area"
      />
    </div>
  );
}

