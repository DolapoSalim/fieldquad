
"use client";

import type React from 'react';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud, X, LayoutGrid, List, Crop } from 'lucide-react'; // Crop icon is already imported
import type { ImageDimensions, ImageState } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ImageUploaderProps {
  onBatchUpload: (imageStates: ImageState[]) => void;
  onImageSelect: (id: string) => void;
  onImageRemove: (id: string) => void;
  onImageCrop: (id: string) => void; // Prop for initiating crop
  batchImages: ImageState[];
  activeImageId: string | null;
}

type ViewMode = 'list' | 'grid';

export function ImageUploader({
  onBatchUpload,
  onImageSelect,
  onImageRemove,
  onImageCrop, // Receive the crop handler
  batchImages = [],
  activeImageId
}: ImageUploaderProps): JSX.Element {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImageStates: ImageState[] = [];
    const processingPromises: Promise<void>[] = [];

    for (const file of Array.from(files)) {
      // Check if an image with the same name already exists in the batch
      if (batchImages.some(img => img.file.name === file.name)) {
        toast({ title: "Duplicate Image", description: `Image "${file.name}" is already in the batch.`, variant: "default" });
        continue; // Skip this file
      }

      if (!file.type.startsWith('image/')) {
        toast({ title: "Invalid File", description: `${file.name} is not an image.`, variant: "destructive" });
        continue;
      }

      const reader = new FileReader();
      const promise = new Promise<void>((resolve, reject) => {
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const img = new Image();
          img.onload = () => {
            const imageState: ImageState = {
              id: crypto.randomUUID(), // Generate a unique ID for batch tracking
              file: file,
              src: dataUrl,
              dimensions: {
                width: img.width, // Use displayed width if needed, often same as natural
                height: img.height, // Use displayed height if needed, often same as natural
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
              },
              annotations: [], // Initialize with empty annotations
              cropArea: null, // Initialize cropArea
            };
            newImageStates.push(imageState);
            resolve();
          };
          img.onerror = reject;
          img.src = dataUrl;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      processingPromises.push(promise);
    }

    try {
      await Promise.all(processingPromises);
      if (newImageStates.length > 0) {
        onBatchUpload(newImageStates);
        toast({ title: "Images Loaded", description: `${newImageStates.length} image(s) ready for annotation.` });
      }
    } catch (error) {
      console.error("Error processing image:", error);
      toast({ title: "Image Load Error", description: "Could not load one or more images.", variant: "destructive" });
    }

    // Reset the input value to allow uploading the same file(s) again (if needed after removal)
     event.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <UploadCloud className="mr-2 h-5 w-5 text-primary" /> Upload Image(s)
          </div>
           {batchImages.length > 0 && (
            <div className="flex items-center space-x-1">
                <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                >
                    <List size={16} />
                </Button>
                <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                >
                    <LayoutGrid size={16} />
                </Button>
            </div>
           )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="image-upload">Select Quadrant Images</Label>
          <Input
            id="image-upload"
            type="file"
            accept="image/*"
            multiple // Allow multiple file selection
            onChange={handleFileChange}
            className="text-sm"
          />
        </div>

        {batchImages.length > 0 && (
          <div className="mt-4 space-y-2">
            <Label>Batch Images ({batchImages.length})</Label>
            <ScrollArea className="h-48 w-full rounded-md border p-1 custom-scrollbar">
             <TooltipProvider delayDuration={300}>
              <div
                className={cn(
                  "p-1",
                  viewMode === 'grid' ? 'grid grid-cols-3 gap-2' : 'space-y-2'
                )}
              >
                {batchImages.map((imgState) => (
                  <div
                    key={imgState.id}
                    className={cn(
                      "relative group border rounded-md cursor-pointer transition-colors overflow-hidden",
                      activeImageId === imgState.id ? "bg-accent/20 border-primary ring-1 ring-primary" : "bg-background hover:bg-muted/50",
                      viewMode === 'list' ? "flex items-center justify-between p-2 pr-10" : "aspect-square flex items-center justify-center" // Adjusted padding for list view buttons
                    )}
                    onClick={() => onImageSelect(imgState.id)}
                    style={{ position: 'relative' }} // Ensure relative positioning for absolute children
                  >
                    {/* Image Preview */}
                    <img
                      src={imgState.src}
                      alt={imgState.file.name}
                      className={cn(
                          "object-cover shrink-0",
                          viewMode === 'list' ? "w-10 h-10 rounded-sm" : "w-full h-full"
                      )}
                      data-ai-hint="batch thumbnail"
                    />
                    {/* Cropped Indicator */}
                    {imgState.cropArea && (
                       <Tooltip>
                        <TooltipTrigger asChild>
                            <Crop size={12} className={cn(
                                "absolute text-primary bg-background/70 rounded p-0.5",
                                viewMode === 'list' ? "left-1 top-1" : "left-1 top-1"
                             )} />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="text-xs">
                            Image is Cropped
                        </TooltipContent>
                       </Tooltip>
                    )}

                     {/* Filename (only for list view or on hover for grid view) */}
                    {viewMode === 'list' && (
                        <span className="text-sm truncate flex-1 min-w-0 ml-2 mr-1">{imgState.file.name}</span>
                    )}
                     {viewMode === 'grid' && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/50 p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                           <p className="text-xs text-white truncate">{imgState.file.name}</p>
                        </div>
                     )}


                    {/* Action Buttons Container */}
                    <div className={cn(
                        "absolute z-10 flex items-center",
                        viewMode === 'list' ? "right-1 top-1/2 -translate-y-1/2 flex-col space-y-1" : "right-1 top-1 flex-col space-y-1",
                         "opacity-0 group-hover:opacity-100 transition-opacity" // Show on hover
                    )}>
                      {/* Crop Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-6 w-6 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full",
                                viewMode === 'grid' && "bg-background/60 hover:bg-primary/20",
                            )}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent selection when clicking crop
                                onImageCrop(imgState.id);
                            }}
                            aria-label={`Crop ${imgState.file.name}`}
                            >
                            <Crop size={14} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side={viewMode === 'list' ? 'left' : 'bottom'} className="text-xs">Crop Image</TooltipContent>
                       </Tooltip>

                      {/* Remove Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full",
                                viewMode === 'grid' && "bg-background/60 hover:bg-destructive/20",
                            )}
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent selection when clicking remove
                              onImageRemove(imgState.id);
                            }}
                            aria-label={`Remove ${imgState.file.name}`}
                          >
                            <X size={14} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side={viewMode === 'list' ? 'left' : 'bottom'} className="text-xs">Remove Image</TooltipContent>
                       </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
              </TooltipProvider>
            </ScrollArea>
            <p className="text-xs text-muted-foreground text-center">Click an image to start annotating it.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

