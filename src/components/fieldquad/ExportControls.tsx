
"use client";

import type React from 'react';
import { Button } from '@/components/ui/button';
import { DownloadCloud } from 'lucide-react';
import type { Annotation, AnnotationClass, ImageDimensions, Point, ExportFormat, CoordinateExportType, ImageState, CoverageExportFormat } from './types';
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
  batchImages: ImageState[]; // Changed from single image props
  annotationClasses: AnnotationClass[];
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

// Extended Coverage data structure to include image identifier
interface CoverageDataItem {
  imageName: string; // Added
  classId: string;
  className: string;
  numericId: number;
  color: string;
  annotationCount: number;
  totalPixelArea: number;
  percentageCoverage: number;
}

// Simplified structure, as details are per item now
type PreparedCoverageData = CoverageDataItem[];


export function ExportControls({
  batchImages,
  annotationClasses,
}: ExportControlsProps): JSX.Element {
  const { toast } = useToast();

  const getSanitizedImageName = (filename: string): string => {
    return filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
  }

  const formatPointForExport = (point: Point, coordFormat: ExportFormat, currentImageDimensions: ImageDimensions): Point => {
    let x = point.x;
    let y = point.y;
    if (coordFormat === 'normalized' && currentImageDimensions && currentImageDimensions.naturalWidth > 0 && currentImageDimensions.naturalHeight > 0) {
      x = point.x / currentImageDimensions.naturalWidth;
      y = point.y / currentImageDimensions.naturalHeight;
      // Ensure normalized coordinates are formatted to a reasonable precision, e.g., 6 decimal places
      return { x: parseFloat(x.toFixed(6)), y: parseFloat(y.toFixed(6)) };
    }
    // For original, round to 2 decimal places or keep as is if integers
    return { x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) };
  };

  const generateTxtAnnotationFileContent = (coordFormat: ExportFormat): string => {
    let fileContent = `# Batch Annotation Export\n`;
    fileContent += `# Annotation Format: class_index x1 y1 x2 y2 ... (bbox/polygon/freehand)\n`;
    fileContent += `# Coordinate Format: ${coordFormat}\n`;

    const classIdToNumericIdMap = new Map<string, number>();
    fileContent += `# Classes:\n`;
    annotationClasses.forEach((ac, index) => {
      classIdToNumericIdMap.set(ac.id, index);
      fileContent += `# ${index}: ${ac.name}\n`;
    });
    fileContent += '\n';

    batchImages.forEach(imgState => {
      if (!imgState.dimensions || imgState.annotations.length === 0) return;

      fileContent += `## Image: ${imgState.file.name}\n`;
      fileContent += `## Image Size: ${imgState.dimensions.naturalWidth}x${imgState.dimensions.naturalHeight} pixels\n`;

      imgState.annotations.forEach(ann => {
        const numericClassId = classIdToNumericIdMap.get(ann.classId);
        if (numericClassId === undefined) return; 

        let pointsToExport = ann.points;
         // Ensure consistent BBox point order (top-left, bottom-right) for export
        if (ann.type === 'bbox' && ann.points.length === 2) {
            const [p1, p2] = ann.points;
            pointsToExport = [
                {x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y)}, 
                {x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y)}
            ];
        }
        
        const coordsStr = pointsToExport.map(p => {
          const formattedP = formatPointForExport(p, coordFormat, imgState.dimensions as ImageDimensions);
          return `${formattedP.x} ${formattedP.y}`;
        }).join(' ');
        fileContent += `${numericClassId} ${coordsStr}\n`;
      });
       fileContent += '\n'; // Separator between images
    });
    return fileContent;
  };
  
  const generateJsonAnnotationFileContent = (coordFormat: ExportFormat): string => {
    const classIdToNumericIdMap = new Map<string, number>();
    const formattedAnnotationClasses = annotationClasses.map((ac, index) => {
        classIdToNumericIdMap.set(ac.id, index);
        return { id: index, name: ac.name, color: ac.color };
    });

    const batchData = batchImages.map(imgState => {
       if (!imgState.dimensions) return null; // Skip images without dimensions

       const formattedAnnotations = imgState.annotations.map(ann => {
           const numericClassId = classIdToNumericIdMap.get(ann.classId);
           if (numericClassId === undefined) return null;

           let pointsToExport = ann.points;
           // Ensure consistent BBox point order (top-left, bottom-right) for export
           if (ann.type === 'bbox' && ann.points.length === 2) {
               const [p1, p2] = ann.points;
               pointsToExport = [
                   {x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y)}, 
                   {x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y)}
               ];
           }
           
           return {
               classId: numericClassId,
               type: ann.type,
               points: pointsToExport.map(p => formatPointForExport(p, coordFormat, imgState.dimensions as ImageDimensions))
           };
       }).filter(ann => ann !== null);

       return {
           imageInfo: {
               name: imgState.file.name,
               width: imgState.dimensions.naturalWidth,
               height: imgState.dimensions.naturalHeight,
           },
           annotations: formattedAnnotations,
       };
    }).filter(imgData => imgData !== null); // Filter out skipped images

    const outputData = {
        batchExportInfo: {
            format: coordFormat,
            annotationClasses: formattedAnnotationClasses,
            date: new Date().toISOString(),
        },
        images: batchData,
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
    toast({ title: "Export Successful", description: `Data downloaded as ${filename}` });
  }

  const handleExportCoordinates = (exportType: CoordinateExportType) => {
    if (batchImages.length === 0) {
       toast({ title: "No Images", description: "Upload images to export annotations.", variant: "default" });
       return;
    }
    // Check if at least one image has annotations
    const hasAnnotations = batchImages.some(img => img.annotations.length > 0);
     if (!hasAnnotations) {
       toast({ title: "No Annotations", description: "There are no annotations in this batch to export.", variant: "default" });
       return;
    }
     // Check if all images with annotations have dimensions
    const imagesWithAnnotations = batchImages.filter(img => img.annotations.length > 0);
    const allHaveDimensions = imagesWithAnnotations.every(img => img.dimensions);
    if (!allHaveDimensions) {
      toast({ title: "Missing Data", description: "Some annotated images are missing dimension data. Cannot export.", variant: "destructive" });
      return;
    }


    const baseFilename = "batch_annotations"; // Base name for batch exports
    let fileContent = "";
    let filename = "";
    let mimeType = "";

    switch (exportType) {
        case 'txt_original':
            fileContent = generateTxtAnnotationFileContent('original');
            filename = `${baseFilename}_original.txt`;
            mimeType = 'text/plain;charset=utf-8';
            break;
        case 'txt_normalized':
            fileContent = generateTxtAnnotationFileContent('normalized');
            filename = `${baseFilename}_normalized.txt`;
            mimeType = 'text/plain;charset=utf-8';
            break;
        case 'json_original':
            fileContent = generateJsonAnnotationFileContent('original');
            filename = `${baseFilename}_original.json`;
            mimeType = 'application/json;charset=utf-8';
            break;
        case 'json_normalized':
            fileContent = generateJsonAnnotationFileContent('normalized');
            filename = `${baseFilename}_normalized.json`;
            mimeType = 'application/json;charset=utf-8';
            break;
        default:
            toast({title: "Error", description: "Invalid export type selected.", variant: "destructive"});
            return;
    }
    downloadFile(fileContent, filename, mimeType);
  };

  const prepareCoverageData = (): PreparedCoverageData | null => {
     if (batchImages.length === 0) {
        toast({ title: "No Images", description: "Upload images to calculate coverage.", variant: "default" });
        return null;
     }
     if (annotationClasses.length === 0) {
         toast({ title: "No Classes", description: "No annotation classes defined to calculate coverage.", variant: "default" });
         return null;
     }
     // Check if images have dimensions
     const allHaveDimensions = batchImages.every(img => img.dimensions && img.dimensions.naturalWidth > 0 && img.dimensions.naturalHeight > 0);
     if (!allHaveDimensions) {
        toast({ title: "Missing Data", description: "Some images are missing dimension data. Cannot calculate coverage.", variant: "destructive" });
        return null;
     }

     const allCoverageData: PreparedCoverageData = [];

     batchImages.forEach(imgState => {
        const { file, dimensions, annotations } = imgState;
        if (!dimensions) return; // Should be caught above, but safe check

        const totalImageArea = dimensions.naturalWidth * dimensions.naturalHeight;
        if (totalImageArea === 0) return; // Skip if area is zero

        annotationClasses.forEach((ac, index) => {
            const annotationsForClass = annotations.filter(ann => ann.classId === ac.id);
            const totalAreaForClass = annotationsForClass.reduce((sum, ann) => sum + calculateSingleAnnotationArea(ann), 0);
            const percentageCoverage = (totalAreaForClass / totalImageArea) * 100;
            
            allCoverageData.push({
                imageName: file.name, // Include image name
                classId: ac.id,
                className: ac.name,
                numericId: index,
                color: ac.color,
                annotationCount: annotationsForClass.length,
                totalPixelArea: parseFloat(totalAreaForClass.toFixed(2)),
                percentageCoverage: parseFloat(percentageCoverage.toFixed(2)),
            });
        });
     });
    
     if (allCoverageData.length === 0 && batchImages.some(img => img.annotations.length > 0)) {
        toast({ title: "Calculation Error", description: "Could not calculate coverage. Check data.", variant: "destructive" });
        return null;
     }
     if (allCoverageData.length === 0 && !batchImages.some(img => img.annotations.length > 0)) {
        toast({ title: "No Annotations", description: "No annotations found in the batch to calculate coverage.", variant: "default" });
        return null;
     }


     return allCoverageData;
  };

  const generateCoverageFileContent = (data: PreparedCoverageData, format: CoverageExportFormat): string => {
    if (format === 'json') {
      // Structure JSON by image for clarity
      const groupedData: Record<string, Omit<CoverageDataItem, 'imageName'>[]> = {};
      data.forEach(item => {
        if (!groupedData[item.imageName]) {
          groupedData[item.imageName] = [];
        }
        const { imageName, ...rest } = item;
        groupedData[item.imageName].push(rest);
      });
       const output = {
            batchExportInfo: {
                format: 'coverage-json',
                date: new Date().toISOString(),
            },
            images: groupedData
       }
       return JSON.stringify(output, null, 2);
    }
    
    if (format === 'txt') {
      let content = `# Batch Coverage Statistics\n`;
      content += `# Date: ${new Date().toISOString()}\n\n`;
      
      const imagesProcessed = new Set<string>();
      data.forEach(stat => {
         if (!imagesProcessed.has(stat.imageName)) {
             const imgDetails = batchImages.find(img => img.file.name === stat.imageName)?.dimensions;
             content += `## Image: ${stat.imageName}\n`;
             if (imgDetails) {
                content += `## Size: ${imgDetails.naturalWidth}x${imgDetails.naturalHeight}\n`;
             }
             content += "--------------------\n";
             imagesProcessed.add(stat.imageName);
         }
         content += `Class Name: ${stat.className}\n`;
         content += `Annotation Count: ${stat.annotationCount}\n`;
         content += `Total Pixel Area: ${stat.totalPixelArea.toFixed(2)}\n`;
         content += `Percentage Coverage: ${stat.percentageCoverage.toFixed(2)}%\n`;
         content += "--------------------\n";
      });
      return content;
    }

    if (format === 'csv') {
      // Add ImageName column for CSV
      let content = "ImageName,ClassName,AnnotationCount,TotalPixelArea,PercentageCoverage\n";
      data.forEach(stat => {
        // Escape commas in class names if necessary
        const classNameEscaped = `"${stat.className.replace(/"/g, '""')}"`;
        content += `${stat.imageName},${classNameEscaped},${stat.annotationCount},${stat.totalPixelArea.toFixed(2)},${stat.percentageCoverage.toFixed(2)}\n`;
      });
      return content;
    }
    return "";
  };

  const handleExportCoverage = (format: CoverageExportFormat) => {
    const coverageData = prepareCoverageData();
    if (!coverageData) {
      // Toasts are handled within prepareCoverageData
      return;
    }

    const fileContent = generateCoverageFileContent(coverageData, format);
    const baseFilename = "batch_coverage";
    let filename = `${baseFilename}`;
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

  const hasAnnotationsInBatch = batchImages.some(img => img.annotations.length > 0);
  const commonAnnotationExportDisabled = batchImages.length === 0 || !hasAnnotationsInBatch;
  const coverageExportDisabled = batchImages.length === 0 || annotationClasses.length === 0 || !batchImages.every(img => img.dimensions);


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><DownloadCloud className="mr-2 h-5 w-5 text-primary" /> Export Batch Data</CardTitle>
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
                <DropdownMenuItem onClick={() => handleExportCoordinates('txt_original')} disabled={commonAnnotationExportDisabled}>
                    Original Coordinates (.txt)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCoordinates('txt_normalized')} disabled={commonAnnotationExportDisabled}>
                    Normalized Coordinates (.txt)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>JSON Format</DropdownMenuLabel>
                 <DropdownMenuItem onClick={() => handleExportCoordinates('json_original')} disabled={commonAnnotationExportDisabled}>
                    Original Coordinates (.json)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCoordinates('json_normalized')} disabled={commonAnnotationExportDisabled}>
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
              <DropdownMenuItem onClick={() => handleExportCoverage('csv')} disabled={coverageExportDisabled}>
                Spreadsheet (.csv)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportCoverage('txt')} disabled={coverageExportDisabled}>
                Text File (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportCoverage('json')} disabled={coverageExportDisabled}>
                JSON File (.json)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
         {(commonAnnotationExportDisabled || coverageExportDisabled) && batchImages.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            { !hasAnnotationsInBatch ? "Add annotations to enable coordinate export." : 
              (annotationClasses.length === 0) ? "Add classes to enable coverage export." :
               !batchImages.every(img => img.dimensions) ? "Image data incomplete for coverage export." :
              "Add data to enable exports." 
            }
          </p>
        )}
         {batchImages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
                Upload images to enable export.
            </p>
         )}
      </CardContent>
    </Card>
  );
}

    
