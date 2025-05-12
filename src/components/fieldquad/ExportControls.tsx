
"use client";

import type React from 'react';
import { Button } from '@/components/ui/button';
import { DownloadCloud } from 'lucide-react';
import type { Annotation, AnnotationClass, ImageDimensions, Point, ExportFormat, CoordinateExportType, ImageState, CoverageExportFormat, CropArea } from './types';
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
  // Annotation coordinates are already relative to the crop area if cropped
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

  // Get effective dimensions (cropped or original) for an image state
  const getEffectiveDimensions = (imgState: ImageState): { width: number, height: number } | null => {
    if (imgState.cropArea) {
      return { width: imgState.cropArea.width, height: imgState.cropArea.height };
    }
    if (imgState.dimensions) {
      return { width: imgState.dimensions.naturalWidth, height: imgState.dimensions.naturalHeight };
    }
    return null;
  }

  // Format point for export, considering normalization relative to *effective* dimensions
  const formatPointForExport = (point: Point, coordFormat: ExportFormat, effectiveDims: { width: number, height: number }): Point => {
    let x = point.x;
    let y = point.y;
    if (coordFormat === 'normalized' && effectiveDims.width > 0 && effectiveDims.height > 0) {
      x = point.x / effectiveDims.width;
      y = point.y / effectiveDims.height;
      // Ensure normalized coordinates are formatted to a reasonable precision
      return { x: parseFloat(x.toFixed(6)), y: parseFloat(y.toFixed(6)) };
    }
    // For original, round to 2 decimal places
    return { x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) };
  };

  const generateTxtAnnotationFileContent = (coordFormat: ExportFormat): string => {
    let fileContent = `# Batch Annotation Export\n`;
    fileContent += `# Annotation Format: class_index x1 y1 x2 y2 ... (bbox/polygon/freehand)\n`;
    fileContent += `# Coordinate Format: ${coordFormat} (relative to effective image size)\n`;

    const classIdToNumericIdMap = new Map<string, number>();
    fileContent += `# Classes:\n`;
    annotationClasses.forEach((ac, index) => {
      classIdToNumericIdMap.set(ac.id, index);
      fileContent += `# ${index}: ${ac.name}\n`;
    });
    fileContent += '\n';

    batchImages.forEach(imgState => {
      const effectiveDims = getEffectiveDimensions(imgState);
      if (!effectiveDims || imgState.annotations.length === 0) return; // Skip images with no annotations or dimensions

      // Image Header Block
      fileContent += `## Image: ${imgState.file.name}\n`;
      fileContent += `## Effective Size: ${effectiveDims.width}x${effectiveDims.height} pixels ${imgState.cropArea ? '(Cropped)' : '(Original)'}\n`;
      if (imgState.cropArea) {
          fileContent += `## Crop Area (Original Coords): x=${imgState.cropArea.x}, y=${imgState.cropArea.y}, w=${imgState.cropArea.width}, h=${imgState.cropArea.height}\n`;
      }


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

        // Format coordinates relative to the effective dimensions
        const coordsStr = pointsToExport.map(p => {
          const formattedP = formatPointForExport(p, coordFormat, effectiveDims);
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
       const effectiveDims = getEffectiveDimensions(imgState);
       if (!effectiveDims) return null; // Skip images without effective dimensions

       const formattedAnnotations = imgState.annotations.map(ann => {
           const numericClassId = classIdToNumericIdMap.get(ann.classId);
           if (numericClassId === undefined) return null;

           let pointsToExport = ann.points;
           // Ensure consistent BBox point order
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
               // Format coordinates relative to the effective dimensions
               points: pointsToExport.map(p => formatPointForExport(p, coordFormat, effectiveDims))
           };
       }).filter(ann => ann !== null);

       return {
           imageInfo: {
               name: imgState.file.name,
               width: effectiveDims.width,
               height: effectiveDims.height,
               isCropped: !!imgState.cropArea,
               cropArea: imgState.cropArea ? { // Report original crop coords
                    x: imgState.cropArea.x,
                    y: imgState.cropArea.y,
                    width: imgState.cropArea.width,
                    height: imgState.cropArea.height,
               } : undefined,
               originalWidth: imgState.dimensions?.naturalWidth,
               originalHeight: imgState.dimensions?.naturalHeight,
           },
           annotations: formattedAnnotations,
       };
    }).filter(imgData => imgData !== null); // Filter out skipped images

    const outputData = {
        batchExportInfo: {
            format: coordFormat,
            coordinatesRelativeTo: "effective_image_size",
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
    const hasAnnotations = batchImages.some(img => img.annotations.length > 0);
     if (!hasAnnotations) {
       toast({ title: "No Annotations", description: "There are no annotations in this batch to export.", variant: "default" });
       return;
    }
     // Check if all images (including those without annotations if desired, or just annotated ones) have dimensions/cropArea
    const allHaveEffectiveDimensions = batchImages.every(img => getEffectiveDimensions(img));
    if (!allHaveEffectiveDimensions) {
      toast({ title: "Missing Data", description: "Some images are missing dimension or crop data. Cannot export.", variant: "destructive" });
      return;
    }

    const baseFilename = "batch_annotations";
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

  // Prepares coverage data based on effective dimensions
  const prepareCoverageData = (): PreparedCoverageData | null => {
     if (batchImages.length === 0) {
        toast({ title: "No Images", description: "Upload images to calculate coverage.", variant: "default" });
        return null;
     }
     if (annotationClasses.length === 0) {
         toast({ title: "No Classes", description: "No annotation classes defined to calculate coverage.", variant: "default" });
         return null;
     }
     // Check if all images have effective dimensions
     const allHaveEffectiveDimensions = batchImages.every(img => getEffectiveDimensions(img));
     if (!allHaveEffectiveDimensions) {
        toast({ title: "Missing Data", description: "Some images are missing dimension or crop data. Cannot calculate coverage.", variant: "destructive" });
        return null;
     }

     const allCoverageData: PreparedCoverageData = [];

     batchImages.forEach(imgState => {
        const effectiveDims = getEffectiveDimensions(imgState);
        const { file, annotations } = imgState;
        if (!effectiveDims) return; // Skip if somehow still missing

        const totalImageArea = effectiveDims.width * effectiveDims.height;
        if (totalImageArea <= 0) return; // Skip if area is zero or negative

        annotationClasses.forEach((ac, index) => {
            const annotationsForClass = annotations.filter(ann => ann.classId === ac.id);
            // Annotation areas are calculated using coordinates relative to the effective area
            const totalAreaForClass = annotationsForClass.reduce((sum, ann) => sum + calculateSingleAnnotationArea(ann), 0);
            const percentageCoverage = (totalAreaForClass / totalImageArea) * 100;

            allCoverageData.push({
                imageName: file.name,
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

     const hasAnyAnnotations = batchImages.some(img => img.annotations.length > 0);
     if (allCoverageData.length === 0 && hasAnyAnnotations) {
        toast({ title: "Calculation Info", description: "No coverage calculated. Ensure annotations are assigned to existing classes.", variant: "default" });
        return null;
     }
     if (allCoverageData.length === 0 && !hasAnyAnnotations) {
        toast({ title: "No Annotations", description: "No annotations found in the batch to calculate coverage.", variant: "default" });
        return null;
     }

     return allCoverageData;
  };

  const generateCoverageFileContent = (data: PreparedCoverageData, format: CoverageExportFormat): string => {
    if (format === 'json') {
      // Group JSON by image
      const groupedData: Record<string, {width: number, height: number, isCropped: boolean, originalWidth?: number, originalHeight?: number, coverageStats: Omit<CoverageDataItem, 'imageName'>[]}> = {};
      data.forEach(item => {
        if (!groupedData[item.imageName]) {
          const imgState = batchImages.find(img => img.file.name === item.imageName);
          const effectiveDims = getEffectiveDimensions(imgState!);
          groupedData[item.imageName] = {
            width: effectiveDims?.width ?? 0,
            height: effectiveDims?.height ?? 0,
            isCropped: !!imgState?.cropArea,
            originalWidth: imgState?.dimensions?.naturalWidth,
            originalHeight: imgState?.dimensions?.naturalHeight,
            coverageStats: []
          };
        }
        const { imageName, ...rest } = item;
        groupedData[item.imageName].coverageStats.push(rest);
      });
       const output = {
            batchExportInfo: {
                format: 'coverage-json',
                coverageRelativeTo: 'effective_image_size',
                date: new Date().toISOString(),
            },
            images: groupedData
       }
       return JSON.stringify(output, null, 2);
    }

    if (format === 'txt') {
      let content = `# Batch Coverage Statistics\n`;
      content += `# Coverage relative to effective image size\n`;
      content += `# Date: ${new Date().toISOString()}\n\n`;

      batchImages.forEach(imgState => {
        const effectiveDims = getEffectiveDimensions(imgState);
        if (!effectiveDims) return; // Skip if no dimensions

        const imageName = imgState.file.name;
        const statsForImage = data.filter(stat => stat.imageName === imageName);
        if (statsForImage.length === 0 && imgState.annotations.length === 0) return; // Skip image if no stats AND no annotations

        // Image Header Block
        content += `## Image: ${imageName}\n`;
        content += `## Effective Size: ${effectiveDims.width}x${effectiveDims.height} pixels ${imgState.cropArea ? '(Cropped)' : '(Original)'}\n`;
        if (imgState.cropArea) {
             content += `## Crop Area (Original Coords): x=${imgState.cropArea.x}, y=${imgState.cropArea.y}, w=${imgState.cropArea.width}, h=${imgState.cropArea.height}\n`;
        }
        content += "--------------------\n";

        // Stats for this image
        if (statsForImage.length > 0) {
             statsForImage.forEach(stat => {
                content += `Class Name: ${stat.className}\n`;
                content += `Annotation Count: ${stat.annotationCount}\n`;
                content += `Total Pixel Area: ${stat.totalPixelArea.toFixed(2)}\n`;
                content += `Percentage Coverage: ${stat.percentageCoverage.toFixed(2)}%\n`;
                content += "--------------------\n";
            });
        } else {
             content += "No annotations found for this image.\n";
             content += "--------------------\n";
        }
        content += '\n'; // Separator between image blocks
      });
      return content;
    }

    if (format === 'csv') {
        // CSV: Each row IS an image
        const sortedClasses = [...annotationClasses].sort((a, b) => a.name.localeCompare(b.name));
        const classHeaders = sortedClasses.flatMap(ac => [
            `${ac.name}_AnnotationCount`,
            `${ac.name}_TotalPixelArea`,
            `${ac.name}_PercentageCoverage`
        ]);
        const header = ["ImageName", "EffectiveWidth", "EffectiveHeight", "IsCropped", "OriginalWidth", "OriginalHeight", "CropX", "CropY", "CropWidth", "CropHeight", ...classHeaders].join(',');

        let csvRows = [header];

        // Group prepared data by image name and class ID
        const dataByImageAndClass: Record<string, Record<string, CoverageDataItem>> = {};
        data.forEach(item => {
            if (!dataByImageAndClass[item.imageName]) {
                dataByImageAndClass[item.imageName] = {};
            }
            dataByImageAndClass[item.imageName][item.classId] = item;
        });

        // Iterate through batch images
        batchImages.forEach(imgState => {
            const effectiveDims = getEffectiveDimensions(imgState);
            if (!effectiveDims) return; // Skip if no effective dimensions

            const imageName = imgState.file.name;
            const imageWidth = effectiveDims.width;
            const imageHeight = effectiveDims.height;
            const isCropped = !!imgState.cropArea;
            const originalWidth = imgState.dimensions?.naturalWidth ?? '';
            const originalHeight = imgState.dimensions?.naturalHeight ?? '';
            const cropX = imgState.cropArea?.x ?? '';
            const cropY = imgState.cropArea?.y ?? '';
            const cropWidth = imgState.cropArea?.width ?? '';
            const cropHeight = imgState.cropArea?.height ?? '';


            // Start the row for this image
            const rowData = [
                imageName,
                imageWidth.toString(),
                imageHeight.toString(),
                isCropped.toString(),
                originalWidth.toString(),
                originalHeight.toString(),
                cropX.toString(),
                cropY.toString(),
                cropWidth.toString(),
                cropHeight.toString()
            ];

            // Add stats for each defined class
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

            // Escape values and join the row
            const escapedRow = rowData.map(value => {
               const strValue = String(value);
               // Basic CSV escaping: double quotes around values containing comma, newline, or double quote itself
               if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                   return `"${strValue.replace(/"/g, '""')}"`;
               }
               return strValue;
            });

            csvRows.push(escapedRow.join(','));
        });

        return csvRows.join('\n');
      }

    return ""; // Should not happen
  };

  const handleExportCoverage = (format: CoverageExportFormat) => {
    const coverageData = prepareCoverageData();
    if (!coverageData) {
      return; // Toasts handled within prepareCoverageData
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
  // Coverage export requires images, classes, and effective dimensions for all images
  const coverageExportDisabled = batchImages.length === 0 || annotationClasses.length === 0 || !batchImages.every(img => getEffectiveDimensions(img));


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
                    Original Pixel Coordinates (.txt)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCoordinates('txt_normalized')} disabled={commonAnnotationExportDisabled}>
                    Normalized Coordinates (.txt)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>JSON Format (Per Image)</DropdownMenuLabel>
                 <DropdownMenuItem onClick={() => handleExportCoordinates('json_original')} disabled={commonAnnotationExportDisabled}>
                    Original Pixel Coordinates (.json)
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
              <DropdownMenuLabel>Format (Batch Summary)</DropdownMenuLabel>
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
              !batchImages.every(img => getEffectiveDimensions(img)) ? "Image data incomplete (dimensions/crop)." :
              "Requires images, classes & dimensions."
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
