
"use client";

import type React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ImageState, CropArea, ImageDimensions } from './types';
import { useToast } from '@/hooks/use-toast';
import { RotateCcw } from 'lucide-react';

interface CropDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageState: ImageState;
  onApplyCrop: (imageId: string, cropArea: CropArea | null) => void;
}

export function CropDialog({
  isOpen,
  onClose,
  imageState,
  onApplyCrop,
}: CropDialogProps): JSX.Element | null {
  const { toast } = useToast();
  const imgRef = useRef<HTMLImageElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Internal state for crop values
  const [x, setX] = useState<number>(0);
  const [y, setY] = useState<number>(0);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);

  // Original image dimensions from state
  const originalDims = imageState.dimensions;

  // Effect to initialize state when dialog opens or image changes
  useEffect(() => {
    if (isOpen && originalDims) {
      if (imageState.cropArea) {
        // Load existing crop area
        setX(imageState.cropArea.x);
        setY(imageState.cropArea.y);
        setWidth(imageState.cropArea.width);
        setHeight(imageState.cropArea.height);
      } else {
        // Default to full image
        setX(0);
        setY(0);
        setWidth(originalDims.naturalWidth);
        setHeight(originalDims.naturalHeight);
      }
      // Reset container size for calculation
      setContainerSize({ width: 0, height: 0 });
    }
  }, [isOpen, imageState, originalDims]);

  // Effect to measure container size for scaling preview
  useEffect(() => {
    if (isOpen && imgRef.current?.parentElement) {
      const observer = new ResizeObserver(entries => {
         for (let entry of entries) {
           const { width, height } = entry.contentRect;
           setContainerSize({ width, height });
         }
      });
      observer.observe(imgRef.current.parentElement);
      return () => observer.disconnect();
    }
  }, [isOpen]);


  const handleApply = () => {
    if (!originalDims) return;

    // Basic Validation
    const numX = Number(x);
    const numY = Number(y);
    const numWidth = Number(width);
    const numHeight = Number(height);

    if (
      isNaN(numX) || isNaN(numY) || isNaN(numWidth) || isNaN(numHeight) ||
      numWidth <= 0 || numHeight <= 0 ||
      numX < 0 || numY < 0 ||
      numX + numWidth > originalDims.naturalWidth ||
      numY + numHeight > originalDims.naturalHeight
    ) {
      toast({
        title: 'Invalid Crop Values',
        description: 'Please ensure crop area is within image bounds and has positive dimensions.',
        variant: 'destructive',
      });
      return;
    }

    const newCropArea: CropArea = {
      x: Math.round(numX),
      y: Math.round(numY),
      width: Math.round(numWidth),
      height: Math.round(numHeight),
    };
    onApplyCrop(imageState.id, newCropArea);
  };

  const handleReset = () => {
    if (!originalDims) return;
    setX(0);
    setY(0);
    setWidth(originalDims.naturalWidth);
    setHeight(originalDims.naturalHeight);
    // Also call onApplyCrop with null to remove crop from state
    onApplyCrop(imageState.id, null);
    toast({ title: 'Crop Reset', description: 'Crop area reset to full image.' });
  };

  // Calculate scaling factor for the preview overlay
  const scale = useMemo(() => {
     if (!originalDims || !containerSize.width || !containerSize.height) return 1;
     return Math.min(containerSize.width / originalDims.naturalWidth, containerSize.height / originalDims.naturalHeight);
  }, [originalDims, containerSize]);


  if (!isOpen || !originalDims) return null;

  // Scaled dimensions for the preview overlay div
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${x * scale}px`,
    top: `${y * scale}px`,
    width: `${width * scale}px`,
    height: `${height * scale}px`,
    border: '2px dashed hsl(var(--primary))',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)', // Dim outside area
    pointerEvents: 'none', // Allow interaction with inputs underneath
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[80vw] md:max-w-[70vw] lg:max-w-[60vw] xl:max-w-[50vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Crop Image: {imageState.file.name}</DialogTitle>
          <DialogDescription>
            Define the area to crop. Annotations outside this area will be ignored. Original: {originalDims.naturalWidth}x{originalDims.naturalHeight}px
          </DialogDescription>
        </DialogHeader>

        {/* Main Area: Image Preview + Controls */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
          {/* Image Preview Column */}
          <div className="md:col-span-2 relative bg-muted/20 flex items-center justify-center overflow-hidden rounded-md border">
             {/* Container for scaling calculation */}
             <div ref={imgRef} className="relative max-w-full max-h-full" style={{aspectRatio: originalDims.naturalWidth / originalDims.naturalHeight}}>
                  <img
                    src={imageState.src}
                    alt="Crop preview"
                    className="block max-w-full max-h-full object-contain"
                    style={{
                       width: `${originalDims.naturalWidth * scale}px`,
                       height: `${originalDims.naturalHeight * scale}px`,
                    }}
                  />
                  {/* Crop Overlay */}
                  <div style={overlayStyle}></div>
             </div>
          </div>

          {/* Controls Column */}
          <div className="flex flex-col space-y-4 overflow-y-auto custom-scrollbar pr-2">
            <p className="text-sm font-medium">Crop Coordinates (pixels)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="crop-x">X (from left)</Label>
                <Input id="crop-x" type="number" value={x} onChange={(e) => setX(Number(e.target.value))} min="0" max={originalDims.naturalWidth} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="crop-y">Y (from top)</Label>
                <Input id="crop-y" type="number" value={y} onChange={(e) => setY(Number(e.target.value))} min="0" max={originalDims.naturalHeight} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="crop-width">Width</Label>
                <Input id="crop-width" type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} min="1" max={originalDims.naturalWidth - x} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="crop-height">Height</Label>
                <Input id="crop-height" type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} min="1" max={originalDims.naturalHeight - y} />
              </div>
            </div>
             <Button variant="outline" onClick={handleReset} className="w-full mt-auto">
                 <RotateCcw className="mr-2 h-4 w-4" /> Reset to Full Image
             </Button>
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleApply}>Apply Crop</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
