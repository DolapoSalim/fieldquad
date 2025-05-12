
"use client";

import type React from 'react';
import { useRef, useEffect, useState, useCallback } from 'react';
import type { Point, Annotation, AnnotationTool, AnnotationClass, ImageDimensions, ShapeData } from './types';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Expand, Minus, Plus, Hand } from 'lucide-react'; // Added Hand
import { cn } from '@/lib/utils';

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
const TEMP_DRAW_FILL_COLOR = `${TEMP_DRAW_COLOR}55`; // Increased opacity
const ANNOTATION_LINE_WIDTH = 2; // Slightly thinner default
const SELECTED_ANNOTATION_LINE_WIDTH = 4; // Thicker selection
const SELECTED_ANNOTATION_COLOR = '#FF8C00'; // DarkOrange for selection highlight
const HANDLE_SIZE = 8; // For resize/move handles
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_SENSITIVITY = 0.001;

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
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the container div

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false); // For new shapes
  const [startPoint, setStartPoint] = useState<Point | null>(null); // In image coordinates
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]); // In image coordinates

  // Dragging state
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [dragStartOffset, setDragStartOffset] = useState<Point | null>(null); // Offset in image coordinates

  // Zoom/Pan state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 }); // Canvas pixel offset
  const [isPanning, setIsPanning] = useState(false); // Flag for active panning (any mouse button)
  const [panStart, setPanStart] = useState<Point | null>(null); // Screen coordinates for panning delta

  const { toast } = useToast();

  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas?.getContext('2d') || null;
  }, []);

  // Converts screen coordinates (relative to canvas element) to image coordinates
  const screenToImageCoords = useCallback((screenX: number, screenY: number): Point => {
    return {
      x: (screenX - offset.x) / zoom,
      y: (screenY - offset.y) / zoom,
    };
  }, [offset.x, offset.y, zoom]);

  // Converts image coordinates to screen coordinates (relative to canvas element)
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

  // Gets mouse position in image coordinates
  const getImageMousePos = useCallback((event: React.MouseEvent<HTMLCanvasElement> | MouseEvent): Point => {
    const { x: screenX, y: screenY } = getCanvasMousePos(event);
    return screenToImageCoords(screenX, screenY);
  }, [getCanvasMousePos, screenToImageCoords]);


  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx || !imageSrc || !imageDimensions) return;

    // Ensure canvas display size matches container, adjust internal size if needed
    const container = containerRef.current;
     if (!container) return;
    const { width: displayWidth, height: displayHeight } = container.getBoundingClientRect();
     if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
       canvas.width = displayWidth;
       canvas.height = displayHeight;
     }


    // Clear canvas (only the visible part)
    ctx.clearRect(0, 0, canvas.width, canvas.height);


    const img = new Image();
    img.src = imageSrc;

    const drawContent = () => {
        ctx.save(); // Save context before applying transformations

        // Apply pan and zoom transformations
        ctx.translate(offset.x, offset.y);
        ctx.scale(zoom, zoom);

        // Draw the image at its origin in the transformed space
        ctx.drawImage(img, 0, 0, imageDimensions.naturalWidth, imageDimensions.naturalHeight);

        // Draw existing annotations (using image coordinates)
        drawAnnotations(ctx, annotations, annotationClasses, selectedAnnotationId, zoom);

         // Draw temporary shape if drawing (using image coordinates)
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
            // Handle image load error - maybe draw placeholder?
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
    imageDimensions,
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
  }, [redrawCanvas]); // Dependencies are now managed within redrawCanvas


  // Recenter and fit image on initial load or image change
  useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || !imageDimensions) return;

      const { width: displayWidth, height: displayHeight } = container.getBoundingClientRect();
      const { naturalWidth, naturalHeight } = imageDimensions;

      const scaleX = displayWidth / naturalWidth;
      const scaleY = displayHeight / naturalHeight;
      const initialZoom = Math.min(scaleX, scaleY) * 0.95; // Fit within 95% of view

      const initialOffsetX = (displayWidth - naturalWidth * initialZoom) / 2;
      const initialOffsetY = (displayHeight - naturalHeight * initialZoom) / 2;

      setZoom(initialZoom);
      setOffset({ x: initialOffsetX, y: initialOffsetY });

      // Force redraw after setting initial zoom/offset
      requestAnimationFrame(() => redrawCanvas());

  }, [imageSrc, imageDimensions]); // Rerun when image changes


  const isPointInsideAnnotationPath = (ctx: CanvasRenderingContext2D, point: Point, annotation: Annotation): boolean => {
     // Use a separate path for hit testing, don't affect main context state
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
    // NOTE: Need to pass the point in IMAGE coordinates here
    return ctx.isPointInPath(path, point.x, point.y);
  };

  const drawAnnotations = (
    ctx: CanvasRenderingContext2D,
    anns: Annotation[],
    classes: AnnotationClass[],
    selectedId: string | null,
    currentZoom: number
    ) => {

    const baseLineWidth = ANNOTATION_LINE_WIDTH / currentZoom;
    const selectedLineWidth = SELECTED_ANNOTATION_LINE_WIDTH / currentZoom;
    const handleSize = HANDLE_SIZE / currentZoom;
    const fontSize = 12 / currentZoom;

    anns.forEach(ann => {
      const annClass = classes.find(ac => ac.id === ann.classId);
      const isSelected = ann.id === selectedId;

      ctx.strokeStyle = isSelected ? SELECTED_ANNOTATION_COLOR : (annClass?.color || TEMP_DRAW_COLOR);
      ctx.fillStyle = annClass ? `${annClass.color}55` : `${TEMP_DRAW_FILL_COLOR}55`;
      if (isSelected) {
        ctx.fillStyle = `${SELECTED_ANNOTATION_COLOR}55`; // More prominent fill for selected
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
            ctx.fillText(annClass.name, minX + (5 / currentZoom), minY + (fontSize * 1.2)); // Adjust text position based on zoom
        }
      } else if ((ann.type === 'polygon' || ann.type === 'freehand') && ann.points.length > 1) {
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x, ann.points[i].y);
        }
        if (ann.type === 'polygon' && ann.points.length > 2) ctx.closePath();
        ctx.stroke();
        // Fill only closed polygons or freehand with enough points to resemble a shape
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
    points: Point[], // Image coordinates
    initialStartPoint: Point | null, // Image coordinates
    tool: AnnotationTool,
    currentZoom: number
    ) => {
    if (!initialStartPoint || points.length === 0 || tool === 'select' || tool === 'pan') return;

    ctx.strokeStyle = TEMP_DRAW_COLOR;
    ctx.fillStyle = TEMP_DRAW_FILL_COLOR;
    ctx.lineWidth = ANNOTATION_LINE_WIDTH / currentZoom; // Adjust line width based on zoom
    ctx.beginPath();

    if (tool === 'bbox') {
        const currentPos = points[points.length - 1]; // Use the last point as current mouse pos
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
         // For polygon, draw line to current mouse pos during drawing (logic moved to mousemove)
        ctx.stroke();
    }
};

const handleZoom = (factor: number, centerX?: number, centerY?: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

     const { width: displayWidth, height: displayHeight } = container.getBoundingClientRect();

    // If center point not provided, use canvas center
    const pivotX = centerX === undefined ? displayWidth / 2 : centerX;
    const pivotY = centerY === undefined ? displayHeight / 2 : centerY;

    // Calculate mouse position in image coordinates before zoom
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
    const delta = event.deltaY * ZOOM_SENSITIVITY * -1; // Invert direction and adjust sensitivity
    const factor = Math.exp(delta); // Exponential zoom factor

    const { x: screenX, y: screenY } = getCanvasMousePos(event);
    handleZoom(factor, screenX, screenY);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageSrc || !imageDimensions) return;
    const ctx = getCanvasContext();
    if (!ctx) return;

    // Middle mouse button OR Left mouse button when 'pan' tool is active
     if (event.button === 1 || (event.button === 0 && currentTool === 'pan')) {
         event.preventDefault(); // Prevent default scroll/pan/text selection behavior
         setIsPanning(true);
         setPanStart({ x: event.clientX, y: event.clientY }); // Use clientX/Y for screen delta calculation
         canvasRef.current?.style.setProperty('cursor', 'grabbing');
         // Ensure other actions are stopped if starting a pan
         setIsDrawing(false);
         setIsDraggingAnnotation(false);
         onSelectAnnotation(null);
         return;
     }
     
     // Left mouse button (button === 0) for other tools
     if (event.button === 0) {
         const pos = getImageMousePos(event); // Position in image coordinates

        if (currentTool === 'select') {
          let clickedAnnotation: Annotation | null = null;
          // Iterate in reverse to select top-most annotation
          for (let i = annotations.length - 1; i >= 0; i--) {
            // Use the raw context for isPointInPath as it doesn't use transformations
            if (isPointInsideAnnotationPath(ctx, pos, annotations[i])) {
              clickedAnnotation = annotations[i];
              break;
            }
          }

          if (clickedAnnotation) {
            onSelectAnnotation(clickedAnnotation.id);
            setIsDraggingAnnotation(true);
            // Calculate offset from the first point of the annotation (image coords) to the mouse click (image coords)
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

        } else if (currentTool === 'bbox' || currentTool === 'polygon' || currentTool === 'freehand') { // Drawing tools
          onSelectAnnotation(null); // Deselect if drawing
          setIsDrawing(true);
          setStartPoint(pos); // Store start point in image coordinates
          if (currentTool === 'polygon') {
              setCurrentPoints(prev => [...prev, pos]);
          } else if (currentTool === 'freehand' || currentTool === 'bbox') {
              setCurrentPoints([pos]);
          }
           // Stop potential pan state if starting to draw
          setIsPanning(false);
          setPanStart(null);
          setIsDraggingAnnotation(false);
        }
     }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageSrc || !imageDimensions) return;
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx) return;

     // Handle Panning (if panning state is active, regardless of which button started it)
    if (isPanning && panStart) {
        const dx = event.clientX - panStart.x;
        const dy = event.clientY - panStart.y;
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setPanStart({ x: event.clientX, y: event.clientY }); // Update pan start for next delta
        redrawCanvas(); // Redraw immediately during pan
        return; // Don't do other actions while panning
    }


    const pos = getImageMousePos(event); // Position in image coordinates

    // Only handle dragging/drawing if not panning
    if (!isPanning) {
        if (isDraggingAnnotation && selectedAnnotationId && dragStartOffset && currentTool === 'select') {
            const draggedAnnotation = annotations.find(ann => ann.id === selectedAnnotationId);
            if (!draggedAnnotation) return;

            // Calculate the new position of the first point based on the drag offset
            const newFirstPointX = pos.x - dragStartOffset.x;
            const newFirstPointY = pos.y - dragStartOffset.y;

            // Calculate the delta shift from the original first point
            const deltaX = newFirstPointX - draggedAnnotation.points[0].x;
            const deltaY = newFirstPointY - draggedAnnotation.points[0].y;

            // Apply the delta shift to all points of the annotation
            const newPoints = draggedAnnotation.points.map(p => ({
                x: p.x + deltaX,
                y: p.y + deltaY
            }));

            const updatedAnnotations = annotations.map(ann =>
                ann.id === selectedAnnotationId ? { ...ann, points: newPoints } : ann
            );
            onAnnotationsChange(updatedAnnotations); // State change will trigger redraw via useEffect

        } else if (isDrawing && startPoint && (currentTool === 'bbox' || currentTool === 'polygon' || currentTool === 'freehand')) {
            if (currentTool === 'bbox' || currentTool === 'freehand') {
                // For bbox and freehand, update the current point list for temporary drawing
                setCurrentPoints(prev => {
                    if (currentTool === 'bbox') {
                        // Bbox only needs start and current pos for drawing
                        return [startPoint, pos];
                    } else { // Freehand adds points continuously
                        return [...prev, pos];
                    }
                });
            }
            // Redraw will be triggered by state change -> redrawCanvas effect.
            // We draw the temporary shape inside redrawCanvas now.
            // For polygon, we only draw the line to the current mouse cursor temporarily during redraw.
            // Need to force redraw if only mouse moves for polygon preview line
            if(currentTool === 'polygon') {
                redrawCanvas(); // Force redraw to show line to cursor
            }
        }
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {

    // End Panning (if started)
    if (isPanning) {
        setIsPanning(false);
        setPanStart(null);
        // Reset cursor based on current tool, unless still holding middle mouse (browser might handle cursor)
        canvasRef.current?.style.setProperty('cursor', getCursor());
        return;
    }


    if (isDraggingAnnotation && currentTool === 'select') {
      setIsDraggingAnnotation(false);
      setDragStartOffset(null);
      // Final state of annotation is already set by onAnnotationsChange in mouseMove
      return;
    }

    if (!isDrawing || !startPoint || currentTool === 'select' || currentTool === 'pan' || !imageSrc) return;

    const pos = getImageMousePos(event); // Image coordinates
    let newShape: ShapeData | null = null;
    let finalPoints = currentPoints; // Start with points accumulated during draw

    if (currentTool === 'bbox') {
      // Bbox final points are just start and end
      if (Math.abs(startPoint.x - pos.x) * zoom > ANNOTATION_LINE_WIDTH && Math.abs(startPoint.y - pos.y) * zoom > ANNOTATION_LINE_WIDTH) {
          // Use startPoint and pos (current mouse up) as the two defining points
          newShape = { type: 'bbox', points: [startPoint, pos] };
      } else {
        toast({ title: "Shape Too Small", description: "Bounding box is too small.", variant: "default" });
      }
    } else if (currentTool === 'freehand') {
        // Add the final mouse up point to the freehand shape
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

    // Reset drawing state only for non-polygon tools on mouse up
    if (currentTool !== 'polygon') {
        setIsDrawing(false);
        setStartPoint(null);
        setCurrentPoints([]);
    } else {
       // For polygon, mouseUp doesn't finish drawing, only mouseDown adds points.
       // Reset isDrawing flag but keep points and start point for next click.
       setIsDrawing(false);
    }
     redrawCanvas(); // Ensure canvas updates after drawing stops/shape potentially discarded
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
     // Complete polygon drawing on double click
    if (currentTool === 'polygon' && currentPoints.length > 2) {
        // Final click point is added on MouseDown, so currentPoints is complete
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
      if (!container || !imageDimensions) return;
       const { width: displayWidth, height: displayHeight } = container.getBoundingClientRect();
       const { naturalWidth, naturalHeight } = imageDimensions;

       const scaleX = displayWidth / naturalWidth;
       const scaleY = displayHeight / naturalHeight;
       const newZoom = Math.min(scaleX, scaleY) * 0.95; // Fit with padding

       const newOffsetX = (displayWidth - naturalWidth * newZoom) / 2;
       const newOffsetY = (displayHeight - naturalHeight * newZoom) / 2;

       setZoom(newZoom);
       setOffset({ x: newOffsetX, y: newOffsetY });
    };


  // Determine cursor based on state
   const getCursor = () => {
      if (isPanning) return 'grabbing'; // Highest priority
      if (currentTool === 'pan') return 'grab';
      if (currentTool === 'select') {
          // TODO: Add resize cursors when hovering over handles
          return selectedAnnotationId ? 'move' : 'default';
      }
      // Drawing tools
      if (currentTool === 'bbox' || currentTool === 'polygon' || currentTool === 'freehand') {
          return 'crosshair';
      }
      return 'default'; // Fallback
   };


  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-muted/10 rounded-md shadow-inner relative flex items-center justify-center overflow-hidden touch-none" // Added touch-none
      data-ai-hint="annotation canvas container"
      tabIndex={0} // Make div focusable for keyboard events if needed
      onWheel={handleWheel} // Attach wheel listener to the container
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { // Stop panning/drawing if mouse leaves canvas
            if (isPanning) {
                setIsPanning(false);
                setPanStart(null);
                 canvasRef.current?.style.setProperty('cursor', getCursor()); // Reset cursor based on tool
            }
            // Stop drawing non-polygon shapes if mouse leaves
            if (isDrawing && currentTool !== 'polygon') {
                setIsDrawing(false);
                 // Decide whether to discard or complete shape on mouse leave (currently discarding)
                 setCurrentPoints([]);
                 setStartPoint(null);
                 redrawCanvas();
            }
        }}
        onDoubleClick={handleDoubleClick}
        className={cn(`cursor-${getCursor()}`)} // Use dynamic cursor based on state and tool
        style={{
          display: 'block',
          // Canvas internal size is set dynamically, these ensure it doesn't overflow container visually
          maxWidth: '100%',
          maxHeight: '100%',
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
            {/* Removed explicit Pan button as it's now a selectable tool */}
            {/* <Button
              variant={currentTool === 'pan' ? 'secondary' : 'outline'}
              size="icon"
              className="h-7 w-7"
              onClick={() => onToolChange('pan')} // Assuming onToolChange exists
              aria-label="Pan Tool"
            >
              <Hand size={16} />
            </Button> */}
            <div className="text-center text-xs font-medium bg-muted/50 px-1 py-0.5 rounded-sm tabular-nums">
                 {`${Math.round(zoom * 100)}%`}
            </div>
        </div>
    </div>
  );
}
