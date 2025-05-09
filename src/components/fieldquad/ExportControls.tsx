
"use client";

import type React from 'react';
import { Button } from '@/components/ui/button';
import { DownloadCloud } from 'lucide-react';
import type { Annotation, AnnotationClass, ImageDimensions, Point, ExportFormat, CoordinateExportType } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

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

type CoverageExportFormat = 'json' | 'txt' | 'csv';

interface CoverageDataItem {
  classId: string;
  className: string;
  numericId: number;
  color: string;
  annotationCount: number;
  totalPixelArea: number;
  percentageCoverage: number;
}

interface PreparedCoverageData {
  imageName: string;
  imageDetails: {
    width: number;
    height: number;
    totalPixelArea: number;
  };
  coverageStatistics: CoverageDataItem[];
}


export function ExportControls({
  annotations,
  annotationClasses,
  imageDimensions,
  imageName = "annotated_image"
}: ExportControlsProps): JSX.Element {
  const { toast } = useToast();

  const getSanitizedImageName = (): string => {
    return imageName.includes('.') ? imageName.substring(0, imageName.lastIndexOf('.')) : imageName;
  }

  const formatPointForExport = (point: Point, coordFormat: ExportFormat, currentImageDimensions: ImageDimensions): Point => {
    let x = point.x;
    let y = point.y;
    if (coordFormat === 'normalized') {
      x = currentImageDimensions.naturalWidth > 0 ? point.x / currentImageDimensions.naturalWidth : 0;
      y = currentImageDimensions.naturalHeight > 0 ? point.y / currentImageDimensions.naturalHeight : 0;
      // Ensure normalized coordinates are formatted to a reasonable precision, e.g., 6 decimal places
      return { x: parseFloat(x.toFixed(6)), y: parseFloat(y.toFixed(6)) };
    }
    // For original, round to 2 decimal places or keep as is if integers
    return { x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) };
  };

  const generateTxtAnnotationFileContent = (coordFormat: ExportFormat, currentImageDimensions: ImageDimensions): string => {
    const totalImageArea = currentImageDimensions.naturalWidth * currentImageDimensions.naturalHeight;
    const classAreaMap = new Map<string, number>();
    annotations.forEach(ann => {
      const area = calculateSingleAnnotationArea(ann);
      classAreaMap.set(ann.classId, (classAreaMap.get(ann.classId) || 0) + area);
    });

    let fileContent = `# Image: ${imageName}\n`;
    fileContent += `# Image Size: ${currentImageDimensions.naturalWidth}x${currentImageDimensions.naturalHeight} pixels\n`;
    fileContent += `# Export Format: ${coordFormat} coordinates\n`;
    
    fileContent += `# Classes (ID: Name - Approx. Coverage %):\n`;
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
          pointsToExport = [{x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y)}, {x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y)}];
      }
      
      const coordsStr = pointsToExport.map(p => {
        const formattedP = formatPointForExport(p, coordFormat, currentImageDimensions);
        return `${formattedP.x} ${formattedP.y}`;
      }).join(' ');
      fileContent += `${numericClassId} ${coordsStr}\n`;
    });
    return fileContent;
  };
  
  const generateJsonAnnotationFileContent = (coordFormat: ExportFormat, currentImageDimensions: ImageDimensions): string => {
    const classIdToNumericIdMap = new Map<string, number>();
    const formattedAnnotationClasses = annotationClasses.map((ac, index) => {
        classIdToNumericIdMap.set(ac.id, index);
        return { id: index, name: ac.name, color: ac.color };
    });

    const formattedAnnotations = annotations.map(ann => {
        const numericClassId = classIdToNumericIdMap.get(ann.classId);
        if (numericClassId === undefined) return null;

        let pointsToExport = ann.points;
        if (ann.type === 'bbox' && ann.points.length === 2) {
            const [p1, p2] = ann.points;
            pointsToExport = [{x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y)}, {x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y)}];
        }
        
        return {
            classId: numericClassId,
            type: ann.type,
            points: pointsToExport.map(p => formatPointForExport(p, coordFormat, currentImageDimensions))
        };
    }).filter(ann => ann !== null);

    const outputData = {
        imageInfo: {
            name: imageName,
            width: currentImageDimensions.naturalWidth,
            height: currentImageDimensions.naturalHeight,
        },
        format: coordFormat,
        annotationClasses: formattedAnnotationClasses,
        annotations: formattedAnnotations,
    };

    return JSON.stringify(outputData, null, 2);
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

  const handleExportCoordinates = (exportType: CoordinateExportType) => {
    if (!imageDimensions || imageDimensions.naturalWidth === 0 || imageDimensions.naturalHeight === 0) {
      toast({ title: "Cannot Export", description: "Image dimensions are not available or invalid.", variant: "destructive" });
      return;
    }
    if (annotations.length === 0) {
      toast({ title: "No Annotations", description: "There are no annotations to export.", variant: "default" });
      return;
    }

    const sanitizedBaseName = getSanitizedImageName();
    let fileContent = "";
    let filename = "";
    let mimeType = "";

    switch (exportType) {
        case 'txt_original':
            fileContent = generateTxtAnnotationFileContent('original', imageDimensions);
            filename = `${sanitizedBaseName}_annotations_original.txt`;
            mimeType = 'text/plain;charset=utf-8';
            break;
        case 'txt_normalized':
            fileContent = generateTxtAnnotationFileContent('normalized', imageDimensions);
            filename = `${sanitizedBaseName}_annotations_normalized.txt`;
            mimeType = 'text/plain;charset=utf-8';
            break;
        case 'json_original':
            fileContent = generateJsonAnnotationFileContent('original', imageDimensions);
            filename = `${sanitizedBaseName}_annotations_original.json`;
            mimeType = 'application/json;charset=utf-8';
            break;
        case 'json_normalized':
            fileContent = generateJsonAnnotationFileContent('normalized', imageDimensions);
            filename = `${sanitizedBaseName}_annotations_normalized.json`;
            mimeType = 'application/json;charset=utf-8';
            break;
        default:
            toast({title: "Error", description: "Invalid export type selected.", variant: "destructive"});
            return;
    }
    downloadFile(fileContent, filename, mimeType);
  };

  const prepareCoverageData = (): PreparedCoverageData | null => {
    if (!imageDimensions || imageDimensions.naturalWidth === 0 || imageDimensions.naturalHeight === 0) {
      toast({ title: "Cannot Export", description: "Image dimensions are not available or invalid for coverage calculation.", variant: "destructive" });
      return null;
    }
    if (annotationClasses.length === 0) {
         toast({ title: "No Classes", description: "No annotation classes defined to calculate coverage.", variant: "default" });
         return null;
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

    return {
      imageName: imageName,
      imageDetails: {
        width: imageDimensions.naturalWidth,
        height: imageDimensions.naturalHeight,
        totalPixelArea: parseFloat(totalImageArea.toFixed(2)),
      },
      coverageStatistics: classCoverageData,
    };
  };

  const generateCoverageFileContent = (data: PreparedCoverageData, format: CoverageExportFormat): string => {
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    
    if (format === 'txt') {
      let content = `Image: ${data.imageName}\n`;
      content += `Image Size: ${data.imageDetails.width}x${data.imageDetails.height} pixels\n`;
      content += `Total Image Area: ${data.imageDetails.totalPixelArea.toFixed(2)} pixels\n\n`;
      content += `Coverage Statistics:\n`;
      content += "--------------------\n";
      data.coverageStatistics.forEach(stat => {
        content += `Class Name: ${stat.className}\n`;
        content += `Annotation Count: ${stat.annotationCount}\n`;
        content += `Total Pixel Area: ${stat.totalPixelArea.toFixed(2)}\n`;
        content += `Percentage Coverage: ${stat.percentageCoverage.toFixed(2)}%\n`;
        content += "--------------------\n";
      });
      return content;
    }

    if (format === 'csv') {
      let content = "ClassName,AnnotationCount,TotalPixelArea,PercentageCoverage\n";
      data.coverageStatistics.forEach(stat => {
        content += `${stat.className},${stat.annotationCount},${stat.totalPixelArea.toFixed(2)},${stat.percentageCoverage.toFixed(2)}\n`;
      });
      return content;
    }
    return "";
  };

  const handleExportCoverage = (format: CoverageExportFormat) => {
    const coverageData = prepareCoverageData();
    if (!coverageData) {
      return;
    }

    if (coverageData.coverageStatistics.length === 0 && annotations.length > 0) {
        toast({ title: "Error", description: "Could not match annotations to classes for coverage export.", variant: "destructive" });
        return;
    }
    
    const fileContent = generateCoverageFileContent(coverageData, format);
    const sanitizedBaseName = getSanitizedImageName();
    let filename = `${sanitizedBaseName}_coverage`;
    let mimeType = '';

    switch (format) {
      case 'json':
        filename += '.json';
        mimeType = 'application/json;charset=utf-8';
        break;
      case 'txt':
        filename += '.txt';
        mimeType = 'text/plain;charset=utf-8';
        break;
      case 'csv':
        filename += '.csv';
        mimeType = 'text/csv;charset=utf-8';
        break;
    }
    downloadFile(fileContent, filename, mimeType);
  };

  const commonAnnotationExportDisabled = annotations.length === 0 || !imageDimensions;
  const coverageExportDisabled = !imageDimensions || annotationClasses.length === 0;


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><DownloadCloud className="mr-2 h-5 w-5 text-primary" /> Export Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="text-sm font-medium mb-2">Annotation Coordinates</h4>
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                className="w-full"
                variant="outline"
                disabled={commonAnnotationExportDisabled}
              >
                Export Coordinates As...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>TXT Format</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExportCoordinates('txt_original')}>
                    Original Coordinates (.txt)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCoordinates('txt_normalized')}>
                    Normalized Coordinates (.txt)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>JSON Format</DropdownMenuLabel>
                 <DropdownMenuItem onClick={() => handleExportCoordinates('json_original')}>
                    Original Coordinates (.json)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCoordinates('json_normalized')}>
                    Normalized Coordinates (.json)
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Separator />
        <div>
          <h4 className="text-sm font-medium mb-2">Coverage Statistics</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                className="w-full"
                variant="outline"
                disabled={coverageExportDisabled}
              >
                Export Coverage As...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuItem onClick={() => handleExportCoverage('csv')}>
                Spreadsheet (.csv for Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportCoverage('txt')}>
                Text File (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportCoverage('json')}>
                JSON File (.json)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
         {(commonAnnotationExportDisabled || coverageExportDisabled) && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            { !imageDimensions ? "Upload an image to enable export." : 
              (annotations.length === 0 && annotationClasses.length === 0) ? "Add classes and annotations to enable export." :
              (annotations.length === 0 && commonAnnotationExportDisabled) ? "Add annotations to enable coordinate export." :
              (annotationClasses.length === 0 && coverageExportDisabled) ? "Add classes to enable coverage export." :
              "Add data to enable exports." 
            }
          </p>
        )}
      </CardContent>
    </Card>
  );
}

    