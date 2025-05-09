
"use client";

import type React from 'react';
import { Button } from '@/components/ui/button';
import { DownloadCloud } from 'lucide-react';
import type { Annotation, AnnotationClass, ImageDimensions, Point, ExportFormat } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';

interface ExportControlsProps {
  annotations: Annotation[];
  annotationClasses: AnnotationClass[];
  imageDimensions: ImageDimensions | null;
  imageName?: string;
}

// Helper function to calculate the area of a polygon using the Shoelace formula
function calculatePolygonArea(points: Point[]): number {
  const n = points.length;
  if (n < 3) return 0; 

  let area = 0;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n]; 
    area += (p1.x * p2.y) - (p2.x * p1.y);
  }
  return Math.abs(area) / 2;
}

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
  return 0;
}

export function ExportControls({
  annotations,
  annotationClasses,
  imageDimensions,
  imageName = "annotated_image" // Default without extension
}: ExportControlsProps): JSX.Element {
  const { toast } = useToast();

  const getSanitizedImageName = (): string => {
    return imageName.includes('.') ? imageName.substring(0, imageName.lastIndexOf('.')) : imageName;
  }

  const formatCoordinatesForExport = (points: Point[], format: ExportFormat, currentImageDimensions: ImageDimensions): string => {
    return points.map(p => {
      let x = p.x;
      let y = p.y;
      if (format === 'normalized') {
        x = currentImageDimensions.naturalWidth > 0 ? p.x / currentImageDimensions.naturalWidth : 0;
        y = currentImageDimensions.naturalHeight > 0 ? p.y / currentImageDimensions.naturalHeight : 0;
      }
      return `${x.toFixed(format === 'normalized' ? 6 : 2)} ${y.toFixed(format === 'normalized' ? 6 : 2)}`;
    }).join(' ');
  };

  const generateTxtFileContent = (format: ExportFormat, currentImageDimensions: ImageDimensions): string => {
    const totalImageArea = currentImageDimensions.naturalWidth * currentImageDimensions.naturalHeight;
    const classAreaMap = new Map<string, number>();
    annotations.forEach(ann => {
      const area = calculateSingleAnnotationArea(ann);
      classAreaMap.set(ann.classId, (classAreaMap.get(ann.classId) || 0) + area);
    });

    let fileContent = `# Image: ${imageName}\n`;
    fileContent += `# Image Size: ${currentImageDimensions.naturalWidth}x${currentImageDimensions.naturalHeight} pixels\n`;
    fileContent += `# Export Format: ${format} coordinates\n`;
    
    fileContent += `# Classes (ID: Name - Coverage %):\n`;
    const classIdToNumericIdMap = new Map<string, number>();
    annotationClasses.forEach((ac, index) => {
      classIdToNumericIdMap.set(ac.id, index);
      const totalAreaForClass = classAreaMap.get(ac.id) || 0;
      const percentageCoverage = totalImageArea > 0 ? (totalAreaForClass / totalImageArea) * 100 : 0;
      fileContent += `# ${index}: ${ac.name} (${percentageCoverage.toFixed(2)}%)\n`;
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
          pointsToExport = [{x: minX, y: minY}, {x: maxX, y: maxY}];
      }
      
      const coordsStr = formatCoordinatesForExport(pointsToExport, format, currentImageDimensions);
      fileContent += `${numericClassId} ${coordsStr}\n`;
    });
    return fileContent;
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Export Successful", description: `Annotations downloaded as ${filename}` });
  }

  const handleExportAnnotationsTXT = (format: ExportFormat) => {
    if (!imageDimensions || imageDimensions.naturalWidth === 0 || imageDimensions.naturalHeight === 0) {
      toast({ title: "Cannot Export", description: "Image dimensions are not available or invalid.", variant: "destructive" });
      return;
    }
    if (annotations.length === 0) {
      toast({ title: "No Annotations", description: "There are no annotations to export.", variant: "default" });
      return;
    }

    const fileContent = generateTxtFileContent(format, imageDimensions);
    const sanitizedBaseName = getSanitizedImageName();
    const filename = `${sanitizedBaseName}_annotations_${format}.txt`;
    downloadFile(fileContent, filename, 'text/plain;charset=utf-8');
  };

  const handleExportCoverageJSON = () => {
    if (!imageDimensions || imageDimensions.naturalWidth === 0 || imageDimensions.naturalHeight === 0) {
      toast({ title: "Cannot Export", description: "Image dimensions are not available or invalid.", variant: "destructive" });
      return;
    }
     if (annotations.length === 0 && annotationClasses.length === 0) { // Allow export if classes exist but no annotations
      toast({ title: "No Data", description: "No classes or annotations to export for coverage.", variant: "default" });
      return;
    }

    const totalImageArea = imageDimensions.naturalWidth * imageDimensions.naturalHeight;
    
    const classCoverageData = annotationClasses.map((ac, index) => {
      const annotationsForClass = annotations.filter(ann => ann.classId === ac.id);
      const totalAreaForClass = annotationsForClass.reduce((sum, ann) => sum + calculateSingleAnnotationArea(ann), 0);
      const percentageCoverage = totalImageArea > 0 ? (totalAreaForClass / totalImageArea) * 100 : 0;
      return {
        classId: ac.id,
        className: ac.name,
        numericId: index,
        color: ac.color,
        annotationCount: annotationsForClass.length,
        totalPixelArea: parseFloat(totalAreaForClass.toFixed(2)),
        percentageCoverage: parseFloat(percentageCoverage.toFixed(2)),
      };
    });

    const exportData = {
      imageName: imageName,
      imageDetails: { // Changed from imageDimensions to imageDetails for clarity
        width: imageDimensions.naturalWidth,
        height: imageDimensions.naturalHeight,
        totalPixelArea: parseFloat(totalImageArea.toFixed(2)),
      },
      coverageStatistics: classCoverageData,
    };

    const fileContent = JSON.stringify(exportData, null, 2);
    const sanitizedBaseName = getSanitizedImageName();
    const filename = `${sanitizedBaseName}_coverage.json`;
    downloadFile(fileContent, filename, 'application/json;charset=utf-8');
  };


  const commonDisabled = annotations.length === 0 || !imageDimensions;
  const coverageDisabled = (annotations.length === 0 && annotationClasses.length === 0) || !imageDimensions;


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><DownloadCloud className="mr-2 h-5 w-5 text-primary" /> Export Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="text-sm font-medium mb-2">Annotation Coordinates (.txt)</h4>
          <div className="space-y-2">
            <Button 
              onClick={() => handleExportAnnotationsTXT('original')} 
              className="w-full" 
              variant="outline"
              disabled={commonDisabled}
            >
              Original Coordinates
            </Button>
            <Button 
              onClick={() => handleExportAnnotationsTXT('normalized')} 
              className="w-full" 
              variant="outline"
              disabled={commonDisabled}
            >
              Normalized Coordinates
            </Button>
          </div>
        </div>
        <Separator />
        <div>
          <h4 className="text-sm font-medium mb-2">Coverage Statistics (.json)</h4>
          <Button 
            onClick={handleExportCoverageJSON} 
            className="w-full"
            variant="outline"
            disabled={coverageDisabled}
          >
            Class Coverage & Area
          </Button>
        </div>
         {(commonDisabled || coverageDisabled) && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            { !imageDimensions ? "Upload an image to enable export." : "Add annotations to enable export."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
