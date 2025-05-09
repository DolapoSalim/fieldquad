"use client";

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { ImageUploader } from '@/components/fieldquad/ImageUploader';
import { AnnotationToolbar } from '@/components/fieldquad/AnnotationToolbar';
import { AnnotationCanvas } from '@/components/fieldquad/AnnotationCanvas';
import { ExportControls } from '@/components/fieldquad/ExportControls';
import type { Annotation, AnnotationClass, AnnotationTool, ImageDimensions } from '@/components/fieldquad/types';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Leaf } from 'lucide-react';

// Helper to generate distinct colors
const PREDEFINED_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#2AB7CA', 
  '#F0B67F', '#FE5F55', '#D65DB1', '#845EC2', '#008F7A',
  '#FFC154', '#EC6B56', '#FF7B54', '#A7226E', '#F26B38',
  '#2E0219', '#644536', '#B2675E', '#D4A276', '#F4DBAA'
];
let colorIndex = 0;

export default function FieldQuadPage(): JSX.Element {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationClasses, setAnnotationClasses] = useState<AnnotationClass[]>([]);
  const [currentTool, setCurrentTool] = useState<AnnotationTool>('bbox');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleImageUpload = (file: File, dataUrl: string, dimensions: ImageDimensions) => {
    setImageFile(file);
    setImageSrc(dataUrl);
    setImageDimensions(dimensions);
    setAnnotations([]); // Reset annotations for new image
    // Do not reset annotationClasses, they can be global to the session
    toast({ title: "Image Loaded", description: `${file.name} is ready for annotation.` });
  };

  const handleAddAnnotation = (newAnnotation: Annotation) => {
    setAnnotations(prev => [...prev, newAnnotation]);
  };

  const handleAnnotationsChange = useCallback((updatedAnnotations: Annotation[]) => {
    setAnnotations(updatedAnnotations);
  }, []);


  const handleCreateClass = (name: string) => {
    const existingClass = annotationClasses.find(ac => ac.name.toLowerCase() === name.toLowerCase());
    if (existingClass) {
      setSelectedClassId(existingClass.id);
      toast({ title: "Class Exists", description: `Selected existing class: ${existingClass.name}`});
      return;
    }

    const newClass: AnnotationClass = {
      id: crypto.randomUUID(),
      name: name,
      color: PREDEFINED_COLORS[colorIndex % PREDEFINED_COLORS.length],
    };
    colorIndex++;
    setAnnotationClasses(prev => [...prev, newClass]);
    setSelectedClassId(newClass.id);
    toast({ title: "Class Created", description: `New class "${name}" added and selected.`});
  };

  const handleSelectClass = (classId: string) => {
    setSelectedClassId(classId);
    const selected = annotationClasses.find(ac => ac.id === classId);
    if (selected) {
        toast({ title: "Class Selected", description: `Current class: ${selected.name}`});
    }
  };

  // Ensure a class is selected by default if classes exist
  useEffect(() => {
    if (!selectedClassId && annotationClasses.length > 0) {
      setSelectedClassId(annotationClasses[0].id);
    }
  }, [annotationClasses, selectedClassId]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto flex items-center">
          <Leaf className="h-8 w-8 mr-3"/>
          <h1 className="text-3xl font-bold tracking-tight">FieldQuAD</h1>
          <span className="ml-2 text-sm opacity-90 hidden md:inline">- Field Quadrant Annotator</span>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="w-full lg:w-1/3 xl:w-1/4 space-y-6 flex-shrink-0">
            <ImageUploader onImageUpload={handleImageUpload} />
            <AnnotationToolbar
              currentTool={currentTool}
              onToolChange={setCurrentTool}
              annotationClasses={annotationClasses}
              onClassCreate={handleCreateClass}
              selectedClassId={selectedClassId}
              onClassSelect={handleSelectClass}
            />
            <ExportControls
              annotations={annotations}
              annotationClasses={annotationClasses}
              imageDimensions={imageDimensions}
              imageName={imageFile?.name}
            />
          </aside>
          
          <section className="flex-1 lg:w-2/3 xl:w-3/4 bg-card p-3 md:p-4 rounded-xl shadow-xl min-h-[400px] md:min-h-[500px] lg:min-h-0">
            <AnnotationCanvas
              imageSrc={imageSrc}
              imageDimensions={imageDimensions}
              annotations={annotations}
              currentTool={currentTool}
              selectedClassId={selectedClassId}
              annotationClasses={annotationClasses}
              onAnnotationAdd={handleAddAnnotation}
              onAnnotationsChange={handleAnnotationsChange}
            />
          </section>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
