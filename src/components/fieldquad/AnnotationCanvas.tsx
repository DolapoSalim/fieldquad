
"use client";

import type React from 'react';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { Point, Annotation, AnnotationTool, AnnotationClass, ImageDimensions, ShapeData, CropArea } from './types';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Expand, Minus, Plus, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnnotationCanvasProps {
  imageSrc: string | null;
  imageDimensions: ImageDimensions | null;
  cropArea: CropArea | null; // Added cropArea prop
  annotations: Annotation[];
  currentTool: AnnotationTool;
  annotationClasses: AnnotationClass[];
  onShapeDrawn: (shape: ShapeData) => void;
  onAnnotationsChange: (annotations: Annotation[]) => void;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
}

const TEMP_DRAW_COLOR = '#008080';
const TEMP_DRAW_FILL_COLOR = `${TEMP_DRAW_COLOR}55`;
const ANNOTATION_LINE_WIDTH = 2;
const SELECTED_ANNOTATION_LINE_WIDTH = 4;
const SELECTED_ANNOTATION_COLOR = '#FF8C00';
const HANDLE_SIZE = 8;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_SENSITIVITY = 0.001;

export function AnnotationCanvas({
  imageSrc,
  imageDimensions,
  cropArea, // Destructure cropArea
  annotations,
  currentTool,
  annotationClasses,
  onShapeDrawn,
  onAnnotationsChange,
  selectedAnnotationId,
  onSelectAnnotation,
}: AnnotationCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null); // In image coordinates (relative to cropArea if exists)
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]); // In image coordinates (relative to cropArea if exists)

  // Dragging state
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [dragStartOffset, setDragStartOffset] = useState<Point | null>(null); // Offset in image coordinates (relative to cropArea)

  // Zoom/Pan state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 }); // Canvas pixel offset
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null); // Screen coordinates for panning delta

  const { toast } = useToast();

  // --- Effective Dimensions ---
  // Use cropped dimensions if available, otherwise full image dimensions
  const effectiveDimensions = useMemo(() => {
      return cropArea
        ? { naturalWidth: cropArea.width, naturalHeight: cropArea.height }
        : imageDimensions;
  }, [cropArea, imageDimensions]);


  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas?.getContext('2d') || null;
  }, []);

  // Converts screen coordinates (relative to canvas element) to image coordinates (relative to the TOP-LEFT of the *effective* (cropped) image area)
  const screenToImageCoords = useCallback((screenX: number, screenY: number): Point => {
    return {
      x: (screenX - offset.x) / zoom,
      y: (screenY - offset.y) / zoom,
    };
  }, [offset.x, offset.y, zoom]);

  // Converts image coordinates (relative to the TOP-LEFT of the *effective* (cropped) image area) to screen coordinates (relative to canvas element)
  const imageToScreenCoords = useCallback((imageX: number, imageY: number): Point => {
    return {
      x: imageX * zoom + offset.x,
      y: imageY * zoom + offset.y,
    };
  }, [offset.x, offset.y, zoom]);

  // Gets mouse position relative to the canvas element (screen coordinates)
  const getCanvasMousePos = useCallback((event: React.MouseEvent<HTMLCanvasElement> | MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  // Gets mouse position in image coordinates (relative to the effective/cropped area)
  const getImageMousePos = useCallback((event: React.MouseEvent<HTMLCanvasElement> | MouseEvent): Point => {
    const { x: screenX, y: screenY } = getCanvasMousePos(event);
    return screenToImageCoords(screenX, screenY);
  }, [getCanvasMousePos, screenToImageCoords]);


  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx || !imageSrc || !effectiveDimensions) return;

    // Ensure canvas display size matches container
    const container = containerRef.current;
     if (!container) return;
    const { width: displayWidth, height: displayHeight } = container.getBoundingClientRect();
     if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
       canvas.width = displayWidth;
       canvas.height = displayHeight;
     }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.src = imageSrc;

    const drawContent = () => {
        ctx.save(); // Save context before applying transformations

        // Apply pan and zoom transformations
        ctx.translate(offset.x, offset.y);
        ctx.scale(zoom, zoom);

        // Draw the image (potentially cropped)
        if (cropArea && imageDimensions) {
            // Draw only the cropped portion of the source image onto the canvas at (0,0) in the transformed space
            ctx.drawImage(
                img,
                cropArea.x, // Source X
                cropArea.y, // Source Y
                cropArea.width, // Source Width
                cropArea.height, // Source Height
                0, // Destination X (top-left of canvas)
                0, // Destination Y (top-left of canvas)
                cropArea.width, // Destination Width (draw at original cropped size)
                cropArea.height // Destination Height (draw at original cropped size)
            );
        } else if (imageDimensions) {
            // Draw the full image at its origin in the transformed space
            ctx.drawImage(img, 0, 0, imageDimensions.naturalWidth, imageDimensions.naturalHeight);
        }

        // Draw existing annotations (using image coordinates relative to the effective/cropped area)
        drawAnnotations(ctx, annotations, annotationClasses, selectedAnnotationId, zoom);

         // Draw temporary shape if drawing (using image coordinates relative to the effective/cropped area)
        if (isDrawing && currentPoints.length > 0 && currentTool !== 'select' && currentTool !== 'pan' && startPoint) {
            drawTemporaryShape(ctx, currentPoints, startPoint, currentTool, zoom);
        }

        ctx.restore(); // Restore context to remove transformations
    };

    if (img.complete && img.naturalHeight !== 0) {
        drawContent();
    } else {
        img.onload = () => {
            drawContent();
        };
        img.onerror = () => {
            // Handle image load error
            console.error("Failed to load image for canvas drawing.");
            ctx.fillStyle = 'grey';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText("Error loading image", canvas.width/2, canvas.height/2);
        };
    }

  }, [
    imageSrc,
    effectiveDimensions, // Use effective dimensions
    imageDimensions, // Still needed for full drawImage call if cropped
    cropArea,
    annotations,
    annotationClasses,
    selectedAnnotationId,
    getCanvasContext,
    isDrawing,
    currentPoints,
    startPoint,
    currentTool,
    zoom,
    offset,
  ]);


  // Effect to redraw canvas whenever relevant state changes
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]); // Dependencies are managed within redrawCanvas


  // Recenter and fit image on initial load or image change/crop change
  useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || !effectiveDimensions) return;

      const { width: displayWidth, height: displayHeight } = container.getBoundingClientRect();
      const { naturalWidth, naturalHeight } = effectiveDimensions; // Use effective dimensions

      if (naturalWidth <= 0 || naturalHeight <= 0) return; // Avoid division by zero

      const scaleX = displayWidth / naturalWidth;
      const scaleY = displayHeight / naturalHeight;
      const initialZoom = Math.min(scaleX, scaleY) * 0.95; // Fit within 95% of view

      const initialOffsetX = (displayWidth - naturalWidth * initialZoom) / 2;
      const initialOffsetY = (displayHeight - naturalHeight * initialZoom) / 2;

      setZoom(initialZoom);
      setOffset({ x: initialOffsetX, y: initialOffsetY });

      // Force redraw after setting initial zoom/offset
      requestAnimationFrame(() => redrawCanvas());

  }, [imageSrc, effectiveDimensions]); // Rerun when image or effectiveDimensions (due to crop) changes


  const isPointInsideAnnotationPath = (ctx: CanvasRenderingContext2D, point: Point, annotation: Annotation): boolean => {
     // Point is in image coordinates (relative to effective/cropped area)
     const path = new Path2D();
     if (annotation.type === 'bbox' && annotation.points.length === 2) {
       const [p1, p2] = annotation.points;
       const minX = Math.min(p1.x, p2.x);
       const minY = Math.min(p1.y, p2.y);
       const width = Math.abs(p1.x - p2.x);
       const height = Math.abs(p1.y - p2.y);
       path.rect(minX, minY, width, height);
     } else if ((annotation.type === 'polygon' || annotation.type === 'freehand') && annotation.points.length > 1) {
       path.moveTo(annotation.points[0].x, annotation.points[0].y);
       for (let i = 1; i < annotation.points.length; i++) {
         path.lineTo(annotation.points[i].x, annotation.points[i].y);
       }
       if (annotation.type === 'polygon' && annotation.points.length > 2) {
         path.closePath();
       }
     } else {
       return false;
     }
     // Check point against the path in the non-transformed context
     // Use the point coordinates directly as they are already relative to the drawn shape origin
     return ctx.isPointInPath(path, point.x, point.y);
   };


  const drawAnnotations = (
    ctx: CanvasRenderingContext2D,
    anns: Annotation[],
    classes: AnnotationClass[],
    selectedId: string | null,
    currentZoom: number
    ) => {
    // Coordinates in anns are relative to the effective (cropped) area

    const baseLineWidth = ANNOTATION_LINE_WIDTH / currentZoom;
    const selectedLineWidth = SELECTED_ANNOTATION_LINE_WIDTH / currentZoom;
    const handleSize = HANDLE_SIZE / currentZoom;
    const fontSize = 12 / currentZoom;

    anns.forEach(ann => {
      // Filter out annotations that are completely outside the current crop area?
      // Maybe not necessary if annotation coordinates are always relative to crop.

      const annClass = classes.find(ac => ac.id === ann.classId);
      const isSelected = ann.id === selectedId;

      ctx.strokeStyle = isSelected ? SELECTED_ANNOTATION_COLOR : (annClass?.color || TEMP_DRAW_COLOR);
      ctx.fillStyle = annClass ? `${annClass.color}55` : `${TEMP_DRAW_FILL_COLOR}55`;
      if (isSelected) {
        ctx.fillStyle = `${SELECTED_ANNOTATION_COLOR}55`;
      }
      ctx.lineWidth = isSelected ? selectedLineWidth : baseLineWidth;

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
            ctx.fillStyle = isSelected ? SELECTED_ANNOTATION_COLOR : annClass.color;
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.fillText(annClass.name, minX + (5 / currentZoom), minY + (fontSize * 1.2));
        }
      } else if ((ann.type === 'polygon' || ann.type === 'freehand') && ann.points.length > 1) {
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x, ann.points[i].y);
        }
        if (ann.type === 'polygon' && ann.points.length > 2) ctx.closePath();
        ctx.stroke();
        if (ann.type === 'polygon' && ann.points.length > 2) ctx.fill();
        else if (ann.type === 'freehand' && ann.points.length > 2) ctx.fill();

        if (annClass && ann.points.length > 0) {
            ctx.fillStyle = isSelected ? SELECTED_ANNOTATION_COLOR : annClass.color;
            ctx.font = `bold ${fontSize}px Arial`;
            const textX = ann.points[0].x + (5 / currentZoom);
            const textY = ann.points[0].y - (5 / currentZoom);
            ctx.fillText(annClass.name, textX, textY);
        }
      }

      // Draw handles if selected
      if (isSelected) {
        ctx.fillStyle = SELECTED_ANNOTATION_COLOR;
        const pointsToDrawHandles = ann.type === 'bbox' && ann.points.length === 2
          ? [ann.points[0], ann.points[1], { x: ann.points[0].x, y: ann.points[1].y }, { x: ann.points[1].x, y: ann.points[0].y }]
          : ann.points;

        pointsToDrawHandles.forEach(p => {
          ctx.fillRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
        });
      }
    });
  };

 const drawTemporaryShape = (
    ctx: CanvasRenderingContext2D,
    points: Point[], // Image coordinates (relative to effective/cropped area)
    initialStartPoint: Point | null, // Image coordinates (relative to effective/cropped area)
    tool: AnnotationTool,
    currentZoom: number
    ) => {
    if (!initialStartPoint || points.length === 0 || tool === 'select' || tool === 'pan') return;

    ctx.strokeStyle = TEMP_DRAW_COLOR;
    ctx.fillStyle = TEMP_DRAW_FILL_COLOR;
    ctx.lineWidth = ANNOTATION_LINE_WIDTH / currentZoom;
    ctx.beginPath();

    if (tool === 'bbox') {
        const currentPos = points[points.length - 1];
        const minX = Math.min(initialStartPoint.x, currentPos.x);
        const minY = Math.min(initialStartPoint.y, currentPos.y);
        const width = Math.abs(initialStartPoint.x - currentPos.x);
        const height = Math.abs(initialStartPoint.y - currentPos.y);
        ctx.rect(minX, minY, width, height);
        ctx.stroke();
        ctx.fill();
    } else if (tool === 'freehand' || tool === 'polygon') {
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    }
};

const handleZoom = (factor: number, centerX?: number, centerY?: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

     const { width: displayWidth, height: displayHeight } = container.getBoundingClientRect();

    const pivotX = centerX === undefined ? displayWidth / 2 : centerX;
    const pivotY = centerY === undefined ? displayHeight / 2 : centerY;

    // Calculate mouse position in image coordinates (relative to effective area) before zoom
    const imagePivot = screenToImageCoords(pivotX, pivotY);

    let newZoom = zoom * factor;
    newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)); // Clamp zoom

    // Calculate new offset to keep the pivot point stationary on screen
    const newOffsetX = pivotX - imagePivot.x * newZoom;
    const newOffsetY = pivotY - imagePivot.y * newZoom;

    setZoom(newZoom);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY * ZOOM_SENSITIVITY * -1;
    const factor = Math.exp(delta);

    const { x: screenX, y: screenY } = getCanvasMousePos(event);
    handleZoom(factor, screenX, screenY);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageSrc || !effectiveDimensions) return;
    const ctx = getCanvasContext();
    if (!ctx) return;

     if (event.button === 1 || (event.button === 0 && currentTool === 'pan')) {
         event.preventDefault();
         setIsPanning(true);
         setPanStart({ x: event.clientX, y: event.clientY });
         canvasRef.current?.style.setProperty('cursor', 'grabbing');
         setIsDrawing(false);
         setIsDraggingAnnotation(false);
         onSelectAnnotation(null);
         return;
     }

     if (event.button === 0) {
         const pos = getImageMousePos(event); // Position relative to effective area

        if (currentTool === 'select') {
          let clickedAnnotation: Annotation | null = null;
          // Use a temporary context to check isPointInPath without affecting the main context's path
          const hitCtx = document.createElement('canvas').getContext('2d');
          if (!hitCtx) return;

          for (let i = annotations.length - 1; i >= 0; i--) {
            if (isPointInsideAnnotationPath(hitCtx, pos, annotations[i])) {
              clickedAnnotation = annotations[i];
              break;
            }
          }

          if (clickedAnnotation) {
            onSelectAnnotation(clickedAnnotation.id);
            setIsDraggingAnnotation(true);
            const offsetX = pos.x - clickedAnnotation.points[0].x;
            const offsetY = pos.y - clickedAnnotation.points[0].y;
            setDragStartOffset({ x: offsetX, y: offsetY });

          } else {
            onSelectAnnotation(null);
            setIsDraggingAnnotation(false);
          }
          setIsDrawing(false);
          setCurrentPoints([]);
          setStartPoint(null);

        } else if (currentTool === 'bbox' || currentTool === 'polygon' || currentTool === 'freehand') {
          onSelectAnnotation(null);
          setIsDrawing(true);
          setStartPoint(pos);
          if (currentTool === 'polygon') {
              setCurrentPoints(prev => [...prev, pos]);
          } else if (currentTool === 'freehand' || currentTool === 'bbox') {
              setCurrentPoints([pos]);
          }
          setIsPanning(false);
          setPanStart(null);
          setIsDraggingAnnotation(false);
        }
     }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageSrc || !effectiveDimensions) return;
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx) return;

    if (isPanning && panStart) {
        const dx = event.clientX - panStart.x;
        const dy = event.clientY - panStart.y;
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setPanStart({ x: event.clientX, y: event.clientY });
        redrawCanvas();
        return;
    }


    const pos = getImageMousePos(event); // Position relative to effective area

    if (!isPanning) {
        if (isDraggingAnnotation && selectedAnnotationId && dragStartOffset && currentTool === 'select') {
            const draggedAnnotation = annotations.find(ann => ann.id === selectedAnnotationId);
            if (!draggedAnnotation) return;

            const newFirstPointX = pos.x - dragStartOffset.x;
            const newFirstPointY = pos.y - dragStartOffset.y;
            const deltaX = newFirstPointX - draggedAnnotation.points[0].x;
            const deltaY = newFirstPointY - draggedAnnotation.points[0].y;

            const newPoints = draggedAnnotation.points.map(p => ({
                x: p.x + deltaX,
                y: p.y + deltaY
            }));

            const updatedAnnotations = annotations.map(ann =>
                ann.id === selectedAnnotationId ? { ...ann, points: newPoints } : ann
            );
            onAnnotationsChange(updatedAnnotations);

        } else if (isDrawing && startPoint && (currentTool === 'bbox' || currentTool === 'polygon' || currentTool === 'freehand')) {
            if (currentTool === 'bbox' || currentTool === 'freehand') {
                setCurrentPoints(prev => {
                    if (currentTool === 'bbox') {
                        return [startPoint, pos];
                    } else {
                        return [...prev, pos];
                    }
                });
            }
             // For polygon, need redraw to show line to cursor
            if(currentTool === 'polygon') {
                 redrawCanvas(); // Redraw to show the line to the cursor
                 // Draw the line to the current mouse position explicitly on top
                if (ctx && currentPoints.length > 0) {
                    ctx.save();
                    ctx.translate(offset.x, offset.y);
                    ctx.scale(zoom, zoom);
                    ctx.beginPath();
                    ctx.strokeStyle = TEMP_DRAW_COLOR;
                    ctx.lineWidth = ANNOTATION_LINE_WIDTH / zoom;
                    ctx.moveTo(currentPoints[currentPoints.length - 1].x, currentPoints[currentPoints.length - 1].y);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                    ctx.restore();
                }
            } else {
                redrawCanvas(); // Redraw for bbox and freehand updates
            }
        }
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {

    if (isPanning) {
        setIsPanning(false);
        setPanStart(null);
        canvasRef.current?.style.setProperty('cursor', getCursor());
        return;
    }

    if (isDraggingAnnotation && currentTool === 'select') {
      setIsDraggingAnnotation(false);
      setDragStartOffset(null);
      return;
    }

    if (!isDrawing || !startPoint || currentTool === 'select' || currentTool === 'pan' || !imageSrc) return;

    const pos = getImageMousePos(event); // Position relative to effective area
    let newShape: ShapeData | null = null;
    let finalPoints = currentPoints;

    if (currentTool === 'bbox') {
      if (Math.abs(startPoint.x - pos.x) * zoom > ANNOTATION_LINE_WIDTH && Math.abs(startPoint.y - pos.y) * zoom > ANNOTATION_LINE_WIDTH) {
          newShape = { type: 'bbox', points: [startPoint, pos] };
      } else {
        toast({ title: "Shape Too Small", description: "Bounding box is too small.", variant: "default" });
      }
    } else if (currentTool === 'freehand') {
        finalPoints = [...currentPoints, pos];
        if (finalPoints.length > 1) {
          newShape = { type: 'freehand', points: finalPoints };
        } else {
          toast({ title: "Shape Too Small", description: "Freehand shape needs more points.", variant: "default" });
        }
    } // Polygon point addition happens on MouseDown, completion on DoubleClick

    if (newShape) {
      onShapeDrawn(newShape);
    }

    // For Polygon, MouseUp doesn't finalize the shape, just adds a point if it was a drag,
    // but our current polygon logic adds points on MouseDown. So MouseUp only matters
    // for bbox and freehand finalization.
    if (currentTool !== 'polygon') {
        setIsDrawing(false);
        setStartPoint(null);
        setCurrentPoints([]);
    } else {
       // For polygon, MouseUp doesn't end the drawing session, only DoubleClick does.
       // We might reset isDrawing here if we only want clicks, not drag-clicks.
       // Let's keep isDrawing false after mouse up for polygon too, for simplicity.
       // Double-click handles finalization. Click (MouseDown) handles adding points.
       setIsDrawing(false); // End potential drag-drawing, but shape isn't final yet.
    }
     redrawCanvas();
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'polygon' && currentPoints.length > 2) {
        const newShape: ShapeData = { type: 'polygon', points: [...currentPoints] };
        onShapeDrawn(newShape);
        setCurrentPoints([]);
        setIsDrawing(false);
        setStartPoint(null);
        redrawCanvas();
    } else if (currentTool === 'polygon' && currentPoints.length <= 2) {
        toast({ title: "Polygon Too Small", description: "A polygon needs at least 3 points. Discarded current points.", variant: "default" });
        setCurrentPoints([]);
        setIsDrawing(false);
        setStartPoint(null);
        redrawCanvas();
    }
  };

    const resetView = () => {
      const container = containerRef.current;
      if (!container || !effectiveDimensions) return;
       const { width: displayWidth, height: displayHeight } = container.getBoundingClientRect();
       const { naturalWidth, naturalHeight } = effectiveDimensions; // Use effective dimensions

       if (naturalWidth <= 0 || naturalHeight <= 0) return;

       const scaleX = displayWidth / naturalWidth;
       const scaleY = displayHeight / naturalHeight;
       const newZoom = Math.min(scaleX, scaleY) * 0.95;

       const newOffsetX = (displayWidth - naturalWidth * newZoom) / 2;
       const newOffsetY = (displayHeight - naturalHeight * newZoom) / 2;

       setZoom(newZoom);
       setOffset({ x: newOffsetX, y: newOffsetY });
    };


   const getCursor = () => {
      if (isPanning) return 'grabbing';
      if (currentTool === 'pan') return 'grab';
      if (currentTool === 'select') {
          // Add logic here to check if hovering over a draggable annotation handle or body
          // For now, simplified: move if selected, default otherwise
          return selectedAnnotationId ? 'move' : 'default';
      }
      if (currentTool === 'bbox' || currentTool === 'polygon' || currentTool === 'freehand') {
          return 'crosshair';
      }
      return 'default';
   };


  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-muted/10 rounded-md shadow-inner relative flex items-center justify-center overflow-hidden touch-none"
      data-ai-hint="annotation canvas container"
      tabIndex={0} // Make div focusable for potential keyboard events later
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={(e) => {
             // Also check if mouse button is still pressed when leaving
            const isMouseButtonPressed = e.buttons === 1;

            if (isPanning && isMouseButtonPressed) {
                 // Don't stop panning if mouse leaves while button is down
            } else if (isPanning && !isMouseButtonPressed) {
                setIsPanning(false);
                setPanStart(null);
                canvasRef.current?.style.setProperty('cursor', getCursor());
            }

            // Stop drawing if mouse leaves (unless it's polygon which continues on click)
            if (isDrawing && currentTool !== 'polygon') {
                setIsDrawing(false);
                 setCurrentPoints([]);
                 setStartPoint(null);
                 redrawCanvas(); // Redraw to remove temporary shape
            }
        }}
         onMouseOut={(e) => { // Handles cases where mouse leaves browser window maybe?
            if (isPanning && e.buttons !== 1) { // Ensure button is up
                setIsPanning(false);
                setPanStart(null);
                canvasRef.current?.style.setProperty('cursor', getCursor());
            }
         }}
        onDoubleClick={handleDoubleClick}
        className={cn(`block max-w-full max-h-full`, getCursor() === 'grabbing' ? 'cursor-grabbing' : getCursor() === 'grab' ? 'cursor-grab' : `cursor-${getCursor()}`)}
        style={{ // Let the parent div handle sizing
        }}
        data-ai-hint="annotation area"
      />
       {/* Zoom Controls Overlay */}
       <div className="absolute top-2 left-2 flex flex-col space-y-1 bg-background/70 p-1 rounded-md shadow">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleZoom(1.2)} aria-label="Zoom In">
                <Plus size={16} />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleZoom(0.8)} aria-label="Zoom Out">
                <Minus size={16} />
            </Button>
             <Button variant="outline" size="icon" className="h-7 w-7" onClick={resetView} aria-label="Reset View">
                <Expand size={16} />
            </Button>
            <div className="text-center text-xs font-medium bg-muted/50 px-1 py-0.5 rounded-sm tabular-nums">
                 {`${Math.round(zoom * 100)}%`}
            </div>
        </div>
    </div>
  );
}
