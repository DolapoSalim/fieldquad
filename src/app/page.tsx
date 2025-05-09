
"use client";

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { ImageUploader } from '@/components/fieldquad/ImageUploader';
import { AnnotationToolbar } from '@/components/fieldquad/AnnotationToolbar';
import { AnnotationCanvas } from '@/components/fieldquad/AnnotationCanvas';
import { ExportControls } from '@/components/fieldquad/ExportControls';
import type { Annotation, AnnotationClass, AnnotationTool, ImageDimensions, Point, ShapeData } from '@/components/fieldquad/types';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Leaf } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  
  const [pendingShapeData, setPendingShapeData] = useState<ShapeData | null>(null);
  const [isClassAssignmentDialogOpen, setIsClassAssignmentDialogOpen] = useState(false);
  const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const { toast } = useToast();

  const handleImageUpload = (file: File, dataUrl: string, dimensions: ImageDimensions) => {
    setImageFile(file);
    setImageSrc(dataUrl);
    setImageDimensions(dimensions);
    setAnnotations([]); 
    setSelectedAnnotationId(null);
    toast({ title: "Image Loaded", description: `${file.name} is ready for annotation.` });
  };

  const handleAnnotationsChange = useCallback((updatedAnnotations: Annotation[]) => {
    setAnnotations(updatedAnnotations);
  }, []);

  const handleShapeDrawn = (shape: ShapeData) => {
    if (annotationClasses.length === 0) {
      toast({
        title: "No Classes Defined",
        description: "Please create at least one annotation class before drawing.",
        variant: "destructive",
      });
      return;
    }
    setPendingShapeData(shape);
    setIsClassAssignmentDialogOpen(true);
    setSelectedAnnotationId(null); 
  };

  const handleAssignClassToShape = (classId: string) => {
    if (!pendingShapeData) return;

    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      classId: classId,
      type: pendingShapeData.type,
      points: pendingShapeData.points,
    };
    setAnnotations(prev => [...prev, newAnnotation]);
    
    const assignedClass = annotationClasses.find(ac => ac.id === classId);
    toast({
      title: "Annotation Added",
      description: `Annotation assigned to class: ${assignedClass?.name || 'Unknown'}`,
    });

    setPendingShapeData(null);
    setIsClassAssignmentDialogOpen(false);
  };

  const handleCreateClass = (name: string) => {
    const existingClass = annotationClasses.find(ac => ac.name.toLowerCase() === name.toLowerCase());
    if (existingClass) {
      setSelectedClassId(existingClass.id); 
      toast({ title: "Class Exists", description: `Class "${existingClass.name}" already exists.`});
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
    toast({ title: "Class Created", description: `New class "${name}" added.`});
  };

  const handleSelectClassForToolbar = (classId: string) => {
    setSelectedClassId(classId);
  };

  const handleSelectAnnotation = useCallback((id: string | null) => {
    setSelectedAnnotationId(id);
    if (id) {
      setCurrentTool('select'); 
    }
  }, []);

  const handleDeleteSelectedAnnotation = useCallback(() => {
    if (!selectedAnnotationId) return;
    setAnnotations(prev => prev.filter(ann => ann.id !== selectedAnnotationId));
    setSelectedAnnotationId(null);
    toast({ title: "Annotation Deleted" });
  }, [selectedAnnotationId, toast]);

  const handleOpenEditClassDialog = () => {
    if (!selectedAnnotationId) {
      toast({ title: "No Annotation Selected", description: "Please select an annotation to change its class.", variant: "destructive" });
      return;
    }
    setIsEditClassDialogOpen(true);
  };

  const handleChangeAnnotationClass = (newClassId: string) => {
    if (!selectedAnnotationId) return;

    setAnnotations(prevAnnotations =>
      prevAnnotations.map(ann =>
        ann.id === selectedAnnotationId ? { ...ann, classId: newClassId } : ann
      )
    );

    const updatedClass = annotationClasses.find(ac => ac.id === newClassId);
    toast({
      title: "Annotation Class Changed",
      description: `Annotation class updated to: ${updatedClass?.name || 'Unknown'}`,
    });

    setIsEditClassDialogOpen(false);
  };


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (selectedAnnotationId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault(); 
        handleDeleteSelectedAnnotation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedAnnotationId, handleDeleteSelectedAnnotation]);


  useEffect(() => {
    if (!selectedClassId && annotationClasses.length > 0) {
      setSelectedClassId(annotationClasses[0].id);
    } else if (selectedClassId && !annotationClasses.find(ac => ac.id === selectedClassId)) {
      setSelectedClassId(annotationClasses.length > 0 ? annotationClasses[0].id : null);
    }
  }, [annotationClasses, selectedClassId]);

  useEffect(() => {
    if (currentTool !== 'select' && selectedAnnotationId) {
      setSelectedAnnotationId(null);
    }
  }, [currentTool, selectedAnnotationId]);


  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="bg-primary text-primary-foreground p-4 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto flex items-center">
          <Leaf className="h-8 w-8 mr-3"/>
          <h1 className="text-3xl font-bold tracking-tight">FieldQuAD</h1>
          <span className="ml-2 text-sm opacity-90 hidden md:inline">- Field Quadrant Annotator</span>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 overflow-hidden">
        <aside className="w-full lg:w-80 xl:w-96 space-y-6 flex-shrink-0 overflow-y-auto pr-2 custom-scrollbar">
          <ImageUploader onImageUpload={handleImageUpload} />
          <AnnotationToolbar
            currentTool={currentTool}
            onToolChange={setCurrentTool}
            annotationClasses={annotationClasses}
            onClassCreate={handleCreateClass}
            selectedClassIdForNewAnnotation={selectedClassId} 
            onClassSelectForToolbar={handleSelectClassForToolbar} 
            selectedAnnotationId={selectedAnnotationId}
            onDeleteSelectedAnnotation={handleDeleteSelectedAnnotation}
            onOpenEditClassDialog={handleOpenEditClassDialog}
          />
          <ExportControls
            annotations={annotations}
            annotationClasses={annotationClasses}
            imageDimensions={imageDimensions}
            imageName={imageFile?.name}
          />
        </aside>
        
        <section className="flex-1 bg-card p-3 md:p-4 rounded-xl shadow-xl min-h-[300px] md:min-h-[400px] lg:min-h-0 flex flex-col overflow-hidden">
          <AnnotationCanvas
            imageSrc={imageSrc}
            imageDimensions={imageDimensions}
            annotations={annotations}
            currentTool={currentTool}
            annotationClasses={annotationClasses}
            onShapeDrawn={handleShapeDrawn}
            onAnnotationsChange={handleAnnotationsChange}
            selectedAnnotationId={selectedAnnotationId}
            onSelectAnnotation={handleSelectAnnotation}
          />
        </section>
      </main>

      <Dialog open={isClassAssignmentDialogOpen} onOpenChange={(isOpen) => {
          setIsClassAssignmentDialogOpen(isOpen);
          if (!isOpen) {
            setPendingShapeData(null); 
          }
        }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Class to Annotation</DialogTitle>
            <DialogDescription>
              Select an annotation class for the shape you just drew.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {annotationClasses.length > 0 ? (
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-2">
                  {annotationClasses.map((ac) => (
                    <Button
                      key={ac.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleAssignClassToShape(ac.id)}
                    >
                      <span style={{ backgroundColor: ac.color }} className="mr-2 h-3 w-3 rounded-full inline-block border border-foreground/20 shrink-0"></span>
                      <span className="truncate">{ac.name}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p>No annotation classes available. Please create one first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => {
              setPendingShapeData(null);
              setIsClassAssignmentDialogOpen(false);
            }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditClassDialogOpen} onOpenChange={setIsEditClassDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Annotation Class</DialogTitle>
            <DialogDescription>
              Select a new class for the currently selected annotation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {annotationClasses.length > 0 ? (
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-2">
                  {annotationClasses.map((ac) => (
                    <Button
                      key={ac.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleChangeAnnotationClass(ac.id)}
                    >
                      <span style={{ backgroundColor: ac.color }} className="mr-2 h-3 w-3 rounded-full inline-block border border-foreground/20 shrink-0"></span>
                      <span className="truncate">{ac.name}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p>No annotation classes available to choose from.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditClassDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Toaster />
    </div>
  );
}
