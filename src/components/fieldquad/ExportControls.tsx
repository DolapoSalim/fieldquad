
"use client";

import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { DownloadCloud } from 'lucide-react';
import type { Annotation, AnnotationClass, ImageDimensions, Point } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";

interface ExportControlsProps {
  annotations: Annotation[];
  annotationClasses: AnnotationClass[];
  imageDimensions: ImageDimensions | null;
  imageName?: string;
}

type ExportFormat = 'original' | 'normalized';

// Helper function to calculate the area of a polygon using the Shoelace formula
function calculatePolygonArea(points: Point[]): number {
  const n = points.length;
  if (n < 3) return 0; // A polygon must have at least 3 vertices

  let area = 0;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n]; // Wraps around for the last vertex
    area += (p1.x * p2.y) - (p2.x * p1.y);
  }
  return Math.abs(area) / 2;
}

// Helper function to calculate the area of a single annotation
function calculateSingleAnnotationArea(annotation: Annotation): number {
  if (annotation.type === 'bbox' && annotation.points.length === 2) {
    const [p1, p2] = annotation.points;
    const width = Math.abs(p1.x - p2.x);
    const height = Math.abs(p1.y - p2.y);
    return width * height;
  }
  if ((annotation.type === 'polygon' || annotation.type === 'freehand') && annotation.points.length >= 3) {
    return calculatePolygonArea(annotation.points);
  }
  return 0; // Return 0 for unsupported types or invalid point counts
}


export function ExportControls({
  annotations,
  annotationClasses,
  imageDimensions,
  imageName = "annotated_image.jpg"
}: ExportControlsProps): JSX.Element {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('original');
  const { toast } = useToast();

  const formatCoordinatesForExport = (points: Point[], format: ExportFormat): string => {
    if (!imageDimensions) return '';
    return points.map(p => {
      let x = p.x;
      let y = p.y;
      if (format === 'normalized') {
        // Ensure naturalWidth and naturalHeight are not zero to prevent NaN/Infinity
        x = imageDimensions.naturalWidth > 0 ? p.x / imageDimensions.naturalWidth : 0;
        y = imageDimensions.naturalHeight > 0 ? p.y / imageDimensions.naturalHeight : 0;
      }
      // Limit decimal places for normalized coordinates
      return `${x.toFixed(format === 'normalized' ? 6 : 2)} ${y.toFixed(format === 'normalized' ? 6 : 2)}`;
    }).join(' ');
  };

  const handleExport = () => {
    if (!imageDimensions || imageDimensions.naturalWidth === 0 || imageDimensions.naturalHeight === 0) {
      toast({ title: "Cannot Export", description: "Image dimensions are not available or invalid.", variant: "destructive" });
      return;
    }
    if (annotations.length === 0) {
      toast({ title: "No Annotations", description: "There are no annotations to export.", variant: "default" });
      return;
    }

    const totalImageArea = imageDimensions.naturalWidth * imageDimensions.naturalHeight;

    const classAreaMap = new Map<string, number>();
    annotations.forEach(ann => {
      const area = calculateSingleAnnotationArea(ann);
      classAreaMap.set(ann.classId, (classAreaMap.get(ann.classId) || 0) + area);
    });

    let fileContent = `# Image: ${imageName}\n`;
    fileContent += `# Image Size: ${imageDimensions.naturalWidth}x${imageDimensions.naturalHeight} pixels\n`;
    fileContent += `# Export Format: ${exportFormat}\n`;
    
    fileContent += `# Classes:\n`;
    const classIdToNumericIdMap = new Map<string, number>();
    annotationClasses.forEach((ac, index) => {
      classIdToNumericIdMap.set(ac.id, index);
      const totalAreaForClass = classAreaMap.get(ac.id) || 0;
      const percentageCoverage = totalImageArea > 0 ? (totalAreaForClass / totalImageArea) * 100 : 0;
      fileContent += `# ${index}: ${ac.name} (Coverage: ${percentageCoverage.toFixed(2)}%)\n`;
    });
    
    fileContent += `# Annotations Format: class_index x1 y1 x2 y2 ... (for bbox, polygon, freehand)\n\n`;

    annotations.forEach(ann => {
      const numericClassId = classIdToNumericIdMap.get(ann.classId);
      if (numericClassId === undefined) return; 

      let pointsToExport = ann.points;
      if (ann.type === 'bbox' && ann.points.length === 2) {
          const [p1, p2] = ann.points;
          const minX = Math.min(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const maxX = Math.max(p1.x, p2.x);
          const maxY = Math.max(p1.y, p2.y);
          // For bbox in YOLO style, export usually center_x, center_y, width, height
          // But current format is x1 y1 x2 y2 ...
          // Let's stick to x_min y_min x_max y_max for bbox to be consistent with what might be expected from "points"
          pointsToExport = [{x: minX, y: minY}, {x: maxX, y: maxY}];
      }
      
      const coordsStr = formatCoordinatesForExport(pointsToExport, exportFormat);
      fileContent += `${numericClassId} ${coordsStr}\n`;
    });

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedImageName = imageName.substring(0, imageName.lastIndexOf('.')) || imageName;
    link.download = `${sanitizedImageName}_annotations_${exportFormat}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "Export Successful", description: `Annotations downloaded as ${link.download}` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><DownloadCloud className="mr-2 h-5 w-5 text-primary" /> Export Annotations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-2 block text-sm font-medium">Coordinate Format</Label>
          <RadioGroup defaultValue="original" value={exportFormat} onValueChange={(value: ExportFormat) => setExportFormat(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="original" id="format-original" />
              <Label htmlFor="format-original" className="font-normal">Original Coordinates (pixels)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="normalized" id="format-normalized" />
              <Label htmlFor="format-normalized" className="font-normal">Normalized Coordinates (0-1)</Label>
            </div>
          </RadioGroup>
        </div>
        <Button onClick={handleExport} className="w-full" disabled={annotations.length === 0 || !imageDimensions}>
          Download .txt File
        </Button>
         {annotations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">No annotations to export.</p>
        )}
        {!imageDimensions && (
            <p className="text-xs text-muted-foreground text-center">Upload an image to enable export.</p>
        )}
      </CardContent>
    </Card>
  );
}

