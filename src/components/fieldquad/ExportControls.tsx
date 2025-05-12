
"use client";

import type React from 'react';
import { Button } from '@/components/ui/button';
import { DownloadCloud } from 'lucide-react';
import type { Annotation, AnnotationClass, Point, ImageState, CoverageExportFormat, CropArea } from './types'; // Removed unused coordinate types
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface ExportControlsProps {
  batchImages: ImageState[];
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

// Extended Coverage data structure to include image identifier and dimensions
interface CoverageDataItem {
  imageName: string;
  effectiveWidth: number;
  effectiveHeight: number;
  isCropped: boolean;
  originalWidth?: number;
  originalHeight?: number;
  cropArea?: CropArea | null;
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

  // Prepares coverage data including image dimensions
  const prepareExportData = (): PreparedCoverageData | null => {
     if (batchImages.length === 0) {
        toast({ title: "No Images", description: "Upload images to export data.", variant: "default" });
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

     const allExportData: PreparedCoverageData = [];

     batchImages.forEach(imgState => {
        const effectiveDims = getEffectiveDimensions(imgState);
        const { file, annotations, cropArea, dimensions } = imgState;
        if (!effectiveDims) return; // Skip if somehow still missing

        const totalImageArea = effectiveDims.width * effectiveDims.height;
        if (totalImageArea <= 0) return; // Skip if area is zero or negative

        annotationClasses.forEach((ac, index) => {
            const annotationsForClass = annotations.filter(ann => ann.classId === ac.id);
            // Annotation areas are calculated using coordinates relative to the effective area
            const totalAreaForClass = annotationsForClass.reduce((sum, ann) => sum + calculateSingleAnnotationArea(ann), 0);
            const percentageCoverage = (totalAreaForClass / totalImageArea) * 100;

            allExportData.push({
                imageName: file.name,
                effectiveWidth: effectiveDims.width,
                effectiveHeight: effectiveDims.height,
                isCropped: !!cropArea,
                originalWidth: dimensions?.naturalWidth,
                originalHeight: dimensions?.naturalHeight,
                cropArea: cropArea, // Include crop info if present
                classId: ac.id,
                className: ac.name,
                numericId: index,
                color: ac.color, // Keep color maybe for reference? Or remove? Keep for now.
                annotationCount: annotationsForClass.length,
                totalPixelArea: parseFloat(totalAreaForClass.toFixed(2)),
                percentageCoverage: parseFloat(percentageCoverage.toFixed(2)),
            });
        });

        // If an image has NO annotations, add a row for it with zero coverage for all classes
        if (imgState.annotations.length === 0) {
             annotationClasses.forEach((ac, index) => {
                 allExportData.push({
                    imageName: file.name,
                    effectiveWidth: effectiveDims.width,
                    effectiveHeight: effectiveDims.height,
                    isCropped: !!cropArea,
                    originalWidth: dimensions?.naturalWidth,
                    originalHeight: dimensions?.naturalHeight,
                    cropArea: cropArea,
                    classId: ac.id,
                    className: ac.name,
                    numericId: index,
                    color: ac.color,
                    annotationCount: 0,
                    totalPixelArea: 0,
                    percentageCoverage: 0,
                 });
             });
        }
     });

     if (allExportData.length === 0) {
        toast({ title: "No Data", description: "No images or classes available to export data.", variant: "default" });
        return null;
     }

     return allExportData;
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


  // Generates file content based on format (TXT, JSON, CSV) containing only dimensions and coverage
   const generateExportFileContent = (data: PreparedCoverageData, format: CoverageExportFormat): string => {
    if (format === 'json') {
      // Group JSON by image
      const groupedData: Record<string, {
          imageInfo: {
              name: string;
              effectiveWidth: number;
              effectiveHeight: number;
              isCropped: boolean;
              originalWidth?: number;
              originalHeight?: number;
              cropArea?: CropArea | null;
          },
          coverageStats: Omit<CoverageDataItem, 'imageName' | 'effectiveWidth' | 'effectiveHeight' | 'isCropped' | 'originalWidth' | 'originalHeight' | 'cropArea'>[]
      }> = {};

      data.forEach(item => {
        if (!groupedData[item.imageName]) {
          groupedData[item.imageName] = {
             imageInfo: {
                name: item.imageName,
                effectiveWidth: item.effectiveWidth,
                effectiveHeight: item.effectiveHeight,
                isCropped: item.isCropped,
                originalWidth: item.originalWidth,
                originalHeight: item.originalHeight,
                cropArea: item.cropArea
             },
             coverageStats: []
          };
        }
        const { imageName, effectiveWidth, effectiveHeight, isCropped, originalWidth, originalHeight, cropArea, ...stats } = item;
        groupedData[item.imageName].coverageStats.push(stats);
      });

       const output = {
            batchExportInfo: {
                exportType: 'Coverage and Dimensions',
                coverageRelativeTo: 'effective_image_size',
                date: new Date().toISOString(),
                // Include class definitions for context
                annotationClasses: annotationClasses.map((ac, index) => ({ id: index, name: ac.name, color: ac.color })),
            },
            images: Object.values(groupedData) // Convert grouped object to array
       }
       return JSON.stringify(output, null, 2);
    }

    if (format === 'txt') {
      let content = `# Batch Coverage Statistics & Dimensions\n`;
      content += `# Coverage relative to effective image size\n`;
      content += `# Date: ${new Date().toISOString()}\n\n`;

      const imagesProcessed = new Set<string>();

      data.forEach(item => {
         if (imagesProcessed.has(item.imageName)) return; // Already processed this image header

         // Image Header Block
         content += `## Image: ${item.imageName}\n`;
         content += `## Effective Size: ${item.effectiveWidth}x${item.effectiveHeight} pixels ${item.isCropped ? '(Cropped)' : '(Original)'}\n`;
         if (item.isCropped && item.cropArea) {
              content += `## Crop Area (Original Coords): x=${item.cropArea.x}, y=${item.cropArea.y}, w=${item.cropArea.width}, h=${item.cropArea.height}\n`;
         }
         if (item.originalWidth && item.originalHeight) {
             content += `## Original Size: ${item.originalWidth}x${item.originalHeight} pixels\n`;
         }
         content += "--------------------\n";
         content += "Class Coverage Stats:\n";

         // Find all stats for this image
         const statsForImage = data.filter(stat => stat.imageName === item.imageName);
         if (statsForImage.length > 0) {
              // Sort stats by class name within the image block
              statsForImage.sort((a, b) => a.className.localeCompare(b.className)).forEach(stat => {
                 content += `  Class Name: ${stat.className}\n`;
                 content += `  Annotation Count: ${stat.annotationCount}\n`;
                 content += `  Total Pixel Area: ${stat.totalPixelArea.toFixed(2)}\n`;
                 content += `  Percentage Coverage: ${stat.percentageCoverage.toFixed(2)}%\n`;
                 content += "  ---\n";
             });
         } else {
              content += "  No annotations found for this image.\n";
              content += "--------------------\n";
         }
          content += '\n'; // Separator between image blocks
          imagesProcessed.add(item.imageName);
      });
      return content;
    }

    if (format === 'csv') {
        // CSV: Each row IS an image, columns for image info + coverage per class
        const sortedClasses = [...annotationClasses].sort((a, b) => a.name.localeCompare(b.name));
        const classHeaders = sortedClasses.flatMap(ac => [
            `${ac.name}_AnnotationCount`,
            `${ac.name}_TotalPixelArea`,
            `${ac.name}_PercentageCoverage`
        ]);
        const header = [
            "ImageName",
            "EffectiveWidth",
            "EffectiveHeight",
            "IsCropped",
            "OriginalWidth",
            "OriginalHeight",
            "CropX",
            "CropY",
            "CropWidth",
            "CropHeight",
            ...classHeaders
        ].join(',');

        let csvRows = [header];

        // Group prepared data by image name and class ID for easy lookup
        const dataByImageAndClass: Record<string, Record<string, CoverageDataItem>> = {};
        data.forEach(item => {
            if (!dataByImageAndClass[item.imageName]) {
                dataByImageAndClass[item.imageName] = {};
            }
            dataByImageAndClass[item.imageName][item.classId] = item;
        });

        // Iterate through unique image names from the prepared data
        const uniqueImageNames = [...new Set(data.map(item => item.imageName))];

        uniqueImageNames.forEach(imageName => {
            // Find the first item for this image to get common image info
            const imageInfoItem = data.find(item => item.imageName === imageName);
            if (!imageInfoItem) return; // Should not happen

            // Start the row for this image
            const rowData = [
                imageName,
                imageInfoItem.effectiveWidth.toString(),
                imageInfoItem.effectiveHeight.toString(),
                imageInfoItem.isCropped.toString(),
                (imageInfoItem.originalWidth ?? '').toString(),
                (imageInfoItem.originalHeight ?? '').toString(),
                (imageInfoItem.cropArea?.x ?? '').toString(),
                (imageInfoItem.cropArea?.y ?? '').toString(),
                (imageInfoItem.cropArea?.width ?? '').toString(),
                (imageInfoItem.cropArea?.height ?? '').toString()
            ];

            // Add stats for each defined class for this image
            sortedClasses.forEach(ac => {
                const stats = dataByImageAndClass[imageName]?.[ac.id];
                if (stats) {
                    rowData.push(stats.annotationCount.toString());
                    rowData.push(stats.totalPixelArea.toFixed(2));
                    rowData.push(stats.percentageCoverage.toFixed(2));
                } else {
                    // Class exists but has no annotations in this image (or image had no annotations)
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

  // Renamed function to handle the combined export
  const handleExportData = (format: CoverageExportFormat) => {
    const exportData = prepareExportData();
    if (!exportData) {
      return; // Toasts handled within prepareExportData
    }

    const fileContent = generateExportFileContent(exportData, format);
    const baseFilename = "fieldquad_batch_data"; // More descriptive base name
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

  // Determine if export should be disabled
  const exportDisabled = batchImages.length === 0 || annotationClasses.length === 0 || !batchImages.every(img => getEffectiveDimensions(img));


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><DownloadCloud className="mr-2 h-5 w-5 text-primary" /> Export Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
         <p className="text-xs text-muted-foreground">
             Export image dimensions and class coverage statistics for the batch.
         </p>
         <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="w-full"
                variant="outline"
                disabled={exportDisabled}
              >
                Export Dimensions & Coverage...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleExportData('csv')} disabled={exportDisabled}>
                Spreadsheet (.csv)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportData('txt')} disabled={exportDisabled}>
                Text File (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportData('json')} disabled={exportDisabled}>
                JSON File (.json)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {exportDisabled && batchImages.length > 0 && (
           <p className="text-xs text-muted-foreground text-center pt-1">
             {annotationClasses.length === 0 ? "Add classes to enable export." :
              !batchImages.every(img => getEffectiveDimensions(img)) ? "Image data incomplete (dimensions/crop)." :
              "Requires images, classes & dimensions."
             }
           </p>
          )}
         {batchImages.length === 0 && (
             <p className="text-xs text-muted-foreground text-center pt-2">
                 Upload images and define classes to enable export.
             </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
