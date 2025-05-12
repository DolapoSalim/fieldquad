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
      if (!imgState.dimensions || imgState.annotations.length === 0) return; // Skip images with no annotations or dimensions

      // Image Header Block (Acts like a row/entry for the image)
      fileContent += `## Image: ${imgState.file.name}\n`;
      fileContent += `## Image Size: ${imgState.dimensions.naturalWidth}x${imgState.dimensions.naturalHeight} pixels\n`;

      // Annotations for this image
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
       fileContent += '\n'; // Separator between image blocks
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

       // Each element in this array represents an image (like a row)
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
        images: batchData, // Array where each element is an image's data
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

  // Prepares coverage data: List where each item is stats for one class in one image
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
                numericId: index, // Numeric ID might still be useful for some contexts
                color: ac.color, // Color might be useful for some contexts
                annotationCount: annotationsForClass.length,
                totalPixelArea: parseFloat(totalAreaForClass.toFixed(2)),
                percentageCoverage: parseFloat(percentageCoverage.toFixed(2)),
            });
        });
     });

     if (allCoverageData.length === 0 && batchImages.some(img => img.annotations.length > 0)) {
        // This case means annotations exist, but maybe classes don't match or areas are zero
        toast({ title: "Calculation Info", description: "No coverage calculated. Ensure annotations are assigned to existing classes.", variant: "default" });
        return null; // Return null as no valid coverage data was generated
     }
     if (allCoverageData.length === 0 && !batchImages.some(img => img.annotations.length > 0)) {
        toast({ title: "No Annotations", description: "No annotations found in the batch to calculate coverage.", variant: "default" });
        return null;
     }


     return allCoverageData;
  };

  const generateCoverageFileContent = (data: PreparedCoverageData, format: CoverageExportFormat): string => {
    if (format === 'json') {
      // Structure JSON by image for clarity - Each image is a key/entry
      const groupedData: Record<string, {width: number, height: number, coverageStats: Omit<CoverageDataItem, 'imageName'>[]}> = {};
      data.forEach(item => {
        if (!groupedData[item.imageName]) {
          const imgDetails = batchImages.find(img => img.file.name === item.imageName)?.dimensions;
          groupedData[item.imageName] = {
            width: imgDetails?.naturalWidth ?? 0,
            height: imgDetails?.naturalHeight ?? 0,
            coverageStats: []
          };
        }
        const { imageName, ...rest } = item;
        groupedData[item.imageName].coverageStats.push(rest);
      });
       const output = {
            batchExportInfo: {
                format: 'coverage-json',
                date: new Date().toISOString(),
            },
            images: groupedData // Object where each key is an image name (entry)
       }
       return JSON.stringify(output, null, 2);
    }

    if (format === 'txt') {
      let content = `# Batch Coverage Statistics\n`;
      content += `# Date: ${new Date().toISOString()}\n\n`;

      const imagesProcessed = new Set<string>();
      batchImages.forEach(imgState => {
        if (!imgState.dimensions) return; // Skip if no dimensions

        const imageName = imgState.file.name;
        const statsForImage = data.filter(stat => stat.imageName === imageName);
        if (statsForImage.length === 0) return; // Skip image if no stats (e.g., no annotations)

        // Image Header Block (Acts like a row/entry for the image)
        content += `## Image: ${imageName}\n`;
        content += `## Size: ${imgState.dimensions.naturalWidth}x${imgState.dimensions.naturalHeight}\n`;
        content += "--------------------\n";

        // Stats for this image
        statsForImage.forEach(stat => {
          content += `Class Name: ${stat.className}\n`;
          content += `Annotation Count: ${stat.annotationCount}\n`;
          content += `Total Pixel Area: ${stat.totalPixelArea.toFixed(2)}\n`;
          content += `Percentage Coverage: ${stat.percentageCoverage.toFixed(2)}%\n`;
          content += "--------------------\n";
        });
        content += '\n'; // Separator between image blocks
      });
      return content;
    }

    if (format === 'csv') {
        // CSV: Each row IS an image
        // 1. Get all unique class names and their order
        const sortedClasses = [...annotationClasses].sort((a, b) => a.name.localeCompare(b.name));
        const classHeaders = sortedClasses.flatMap(ac => [
            `${ac.name}_AnnotationCount`,
            `${ac.name}_TotalPixelArea`,
            `${ac.name}_PercentageCoverage`
        ]);
        const header = ["ImageName", "ImageWidth", "ImageHeight", ...classHeaders].join(',');

        let csvRows = [header];

        // 2. Group prepared data by image name and class ID for efficient lookup
        const dataByImageAndClass: Record<string, Record<string, CoverageDataItem>> = {};
        data.forEach(item => {
            if (!dataByImageAndClass[item.imageName]) {
                dataByImageAndClass[item.imageName] = {};
            }
            dataByImageAndClass[item.imageName][item.classId] = item;
        });

        // 3. Iterate through batch images to build rows
        batchImages.forEach(imgState => {
            if (!imgState.dimensions) return; // Skip if no dimensions

            const imageName = imgState.file.name;
            const imageWidth = imgState.dimensions.naturalWidth;
            const imageHeight = imgState.dimensions.naturalHeight;

            // Start the row for this image
            const rowData = [imageName, imageWidth.toString(), imageHeight.toString()];

            // 4. For each defined class, find its stats for the current image
            sortedClasses.forEach(ac => {
                const stats = dataByImageAndClass[imageName]?.[ac.id];
                if (stats) {
                    rowData.push(stats.annotationCount.toString());
                    rowData.push(stats.totalPixelArea.toFixed(2));
                    rowData.push(stats.percentageCoverage.toFixed(2));
                } else {
                    // Class exists but has no annotations in this image
                    rowData.push("0"); // Count
                    rowData.push("0.00"); // Area
                    rowData.push("0.00"); // Coverage
                }
            });

            // 5. Escape values and join the row
            const escapedRow = rowData.map(value => {
               const strValue = String(value);
               if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                   return `"${strValue.replace(/"/g, '""')}"`;
               }
               return strValue;
            });

            csvRows.push(escapedRow.join(','));
        });

        return csvRows.join('\n');
      }

    return ""; // Should not happen if format is validated
  };

  const handleExportCoverage = (format: CoverageExportFormat) => {
    const coverageData = prepareCoverageData();
    if (!coverageData) {
      // Toasts are handled within prepareCoverageData if there's an issue or no data
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
  // Coverage export requires images, classes, and dimensions for all images
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
                <DropdownMenuLabel>TXT Format (Per Image)</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExportCoordinates('txt_original')} disabled={commonAnnotationExportDisabled}>
                    Original Coordinates (.txt)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCoordinates('txt_normalized')} disabled={commonAnnotationExportDisabled}>
                    Normalized Coordinates (.txt)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>JSON Format (Per Image)</DropdownMenuLabel>
                 <DropdownMenuItem onClick={() => handleExportCoordinates('json_original')} disabled={commonAnnotationExportDisabled}>
                    Original Coordinates (.json)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCoordinates('json_normalized')} disabled={commonAnnotationExportDisabled}>
                    Normalized Coordinates (.json)
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
           {commonAnnotationExportDisabled && batchImages.length > 0 && !hasAnnotationsInBatch && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Add annotations to enable coordinate export.
            </p>
           )}
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
              <DropdownMenuLabel>Format (Per Image)</DropdownMenuLabel>
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
          {coverageExportDisabled && batchImages.length > 0 && (
           <p className="text-xs text-muted-foreground text-center pt-1">
             {annotationClasses.length === 0 ? "Add classes to enable coverage export." :
              !batchImages.every(img => img.dimensions) ? "Image data incomplete." :
              "Requires images, classes &amp; dimensions."
             }
           </p>
          )}
        </div>

         {batchImages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
                Upload images to enable export.
            </p>
         )}
      </CardContent>
    </Card>
  );
}