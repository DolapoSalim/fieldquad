
"use client";

import type React from 'react';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud, X } from 'lucide-react';
import type { ImageDimensions, ImageState } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  onBatchUpload: (imageStates: ImageState[]) => void;
  onImageSelect: (id: string) => void;
  onImageRemove: (id: string) => void;
  batchImages: ImageState[];
  activeImageId: string | null;
}

export function ImageUploader({ 
  onBatchUpload,
  onImageSelect,
  onImageRemove,
  batchImages = [],
  activeImageId 
}: ImageUploaderProps): JSX.Element {
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImageStates: ImageState[] = [];
    const processingPromises: Promise<void>[] = [];

    for (const file of Array.from(files)) {
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
                width: img.width,
                height: img.height,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
              },
              annotations: [], // Initialize with empty annotations
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

    // Reset the input value to allow uploading the same file(s) again
     event.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><UploadCloud className="mr-2 h-5 w-5 text-primary" /> Upload Image(s)</CardTitle>
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
            <ScrollArea className="h-48 w-full rounded-md border p-2 custom-scrollbar">
              <div className="space-y-2">
                {batchImages.map((imgState) => (
                  <div 
                    key={imgState.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors",
                      activeImageId === imgState.id ? "bg-accent/20 border-primary" : "bg-background hover:bg-muted/50"
                    )}
                    onClick={() => onImageSelect(imgState.id)}
                  >
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <img 
                        src={imgState.src} 
                        alt={imgState.file.name} 
                        className="w-10 h-10 object-cover rounded-sm shrink-0" 
                        data-ai-hint="batch thumbnail" 
                      />
                      <span className="text-sm truncate flex-1 min-w-0">{imgState.file.name}</span>
                    </div>
                     <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent selection when clicking remove
                        onImageRemove(imgState.id);
                      }}
                      aria-label={`Remove ${imgState.file.name}`}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground text-center">Click an image to start annotating it.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
