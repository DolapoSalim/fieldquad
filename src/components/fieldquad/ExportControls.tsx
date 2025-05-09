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
        x = p.x / imageDimensions.naturalWidth;
        y = p.y / imageDimensions.naturalHeight;
      }
      // Limit decimal places for normalized coordinates
      return `${x.toFixed(format === 'normalized' ? 6 : 2)} ${y.toFixed(format === 'normalized' ? 6 : 2)}`;
    }).join(' ');
  };

  const handleExport = () => {
    if (!imageDimensions) {
      toast({ title: "Cannot Export", description: "Image dimensions are not available.", variant: "destructive" });
      return;
    }
    if (annotations.length === 0) {
      toast({ title: "No Annotations", description: "There are no annotations to export.", variant: "default" });
      return;
    }

    let fileContent = `# Image: ${imageName}\n`;
    fileContent += `# Export Format: ${exportFormat}\n`;
    
    fileContent += `# Classes:\n`;
    const classIdToNumericIdMap = new Map<string, number>();
    annotationClasses.forEach((ac, index) => {
      fileContent += `# ${index}: ${ac.name}\n`;
      classIdToNumericIdMap.set(ac.id, index);
    });
    
    fileContent += `# Annotations Format: class_index x1 y1 x2 y2 ... (for bbox, polygon, freehand)\n\n`;

    annotations.forEach(ann => {
      const numericClassId = classIdToNumericIdMap.get(ann.classId);
      if (numericClassId === undefined) return; // Should not happen

      // For bbox, ensure points are minX, minY, maxX, maxY before formatting
      let pointsToExport = ann.points;
      if (ann.type === 'bbox' && ann.points.length === 2) {
          const [p1, p2] = ann.points;
          const minX = Math.min(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const maxX = Math.max(p1.x, p2.x);
          const maxY = Math.max(p1.y, p2.y);
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
              <Label htmlFor="format-original" className="font-normal">Original Coordinates</Label>
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
      </CardContent>
    </Card>
  );
}
