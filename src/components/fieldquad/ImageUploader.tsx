"use client";

import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud } from 'lucide-react';
import type { ImageDimensions } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ImageUploaderProps {
  onImageUpload: (file: File, dataUrl: string, dimensions: ImageDimensions) => void;
}

export function ImageUploader({ onImageUpload }: ImageUploaderProps): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
        const img = new Image();
        img.onload = () => {
          // For now, display dimensions are same as natural, can be adjusted later if scaling is implemented
          onImageUpload(file, reader.result as string, {
            width: img.width,
            height: img.height,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><UploadCloud className="mr-2 h-5 w-5 text-primary" /> Upload Image</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="image-upload">Select Quadrant Image</Label>
          <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
        </div>
        {previewUrl && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-1">Preview:</p>
            <img src={previewUrl} alt="Selected" className="max-w-full h-auto rounded-md border" data-ai-hint="field quadrant" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
