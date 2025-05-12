
"use client";

import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ImageUploader } from '@/components/fieldquad/ImageUploader';
import { AnnotationToolbar } from '@/components/fieldquad/AnnotationToolbar';
import { AnnotationCanvas } from '@/components/fieldquad/AnnotationCanvas';
import { ExportControls } from '@/components/fieldquad/ExportControls';
import type { Annotation, AnnotationClass, AnnotationTool, ImageDimensions, Point, ShapeData, ImageState } from '@/components/fieldquad/types';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Leaf, ImageOff } from 'lucide-react';
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
  // State for batch processing
  const [batchImages, setBatchImages] = useState<ImageState[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);

  // Annotation Classes (global for the session)
  const [annotationClasses, setAnnotationClasses] = useState<AnnotationClass[]>([]);
  
  // Current Tool and Selection State (applies to active image)
  const [currentTool, setCurrentTool] = useState<AnnotationTool>('bbox');
  const [selectedClassIdForToolbar, setSelectedClassIdForToolbar] = useState<string | null>(null); // Class highlighted in toolbar
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null); // ID of annotation selected on canvas

  // Dialog states
  const [pendingShapeData, setPendingShapeData] = useState<ShapeData | null>(null);
  const [isClassAssignmentDialogOpen, setIsClassAssignmentDialogOpen] = useState(false);
  const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);

  const { toast } = useToast();

  // --- Batch Image Handling ---

  const handleBatchUpload = (newImageStates: ImageState[]) => {
    setBatchImages(prev => [...prev, ...newImageStates]);
    // Activate the first image of the new batch if no image is active yet
    if (!activeImageId && newImageStates.length > 0) {
      setActiveImageId(newImageStates[0].id);
    }
  };

  const handleSelectImageFromBatch = (id: string) => {
    if (id !== activeImageId) {
      setActiveImageId(id);
      setSelectedAnnotationId(null); // Clear selection when switching image
      setCurrentTool('bbox'); // Reset tool
      setPendingShapeData(null); // Clear any pending shape
      setIsClassAssignmentDialogOpen(false); // Close dialogs
      setIsEditClassDialogOpen(false);
      toast({ title: "Image Switched", description: `Now annotating: ${batchImages.find(img => img.id === id)?.file.name}` });
    }
  };

  const handleRemoveImageFromBatch = (idToRemove: string) => {
    setBatchImages(prev => prev.filter(img => img.id !== idToRemove));
    if (activeImageId === idToRemove) {
      // If the removed image was active, select the next available one, or null if none left
      const remainingImages = batchImages.filter(img => img.id !== idToRemove);
      setActiveImageId(remainingImages.length > 0 ? remainingImages[0].id : null);
    }
     toast({ title: "Image Removed", description: `Image removed from batch.` });
  };


  // --- Derived State for Active Image ---
  const activeImage = useMemo(() => {
    return batchImages.find(img => img.id === activeImageId) || null;
  }, [batchImages, activeImageId]);

  const activeImageSrc = activeImage?.src || null;
  const activeImageDimensions = activeImage?.dimensions || null;
  const activeAnnotations = activeImage?.annotations || [];

  // --- Annotation Handling Callbacks (Modified for Active Image) ---

  const handleAnnotationsChange = useCallback((updatedAnnotations: Annotation[]) => {
    if (!activeImageId) return;
    setBatchImages(prev => 
      prev.map(img => 
        img.id === activeImageId 
          ? { ...img, annotations: updatedAnnotations } 
          : img
      )
    );
    // No need to call setAnnotations directly anymore
  }, [activeImageId]);

  const handleShapeDrawn = (shape: ShapeData) => {
    if (!activeImage) {
       toast({ title: "No Active Image", description: "Please select an image from the batch first.", variant: "destructive" });
       return;
    }
    if (annotationClasses.length === 0) {
      toast({ title: "No Classes Defined", description: "Please create at least one annotation class before drawing.", variant: "destructive" });
      return;
    }
    setPendingShapeData(shape);
    setIsClassAssignmentDialogOpen(true);
    setSelectedAnnotationId(null); 
  };

  const handleAssignClassToShape = (classId: string) => {
    if (!pendingShapeData || !activeImageId) return;

    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      classId: classId,
      type: pendingShapeData.type,
      points: pendingShapeData.points,
    };
    
    // Update annotations for the active image
    setBatchImages(prev => 
      prev.map(img => 
        img.id === activeImageId 
          ? { ...img, annotations: [...img.annotations, newAnnotation] } 
          : img
      )
    );
    
    const assignedClass = annotationClasses.find(ac => ac.id === classId);
    toast({
      title: "Annotation Added",
      description: `Annotation assigned to class: ${assignedClass?.name || 'Unknown'}`,
    });

    setPendingShapeData(null);
    setIsClassAssignmentDialogOpen(false);
  };

  const handleDeleteSelectedAnnotation = useCallback(() => {
    if (!selectedAnnotationId || !activeImageId) return;
    
    setBatchImages(prev => 
      prev.map(img => 
        img.id === activeImageId 
          ? { ...img, annotations: img.annotations.filter(ann => ann.id !== selectedAnnotationId) } 
          : img
      )
    );
    
    setSelectedAnnotationId(null);
    toast({ title: "Annotation Deleted" });
  }, [selectedAnnotationId, activeImageId, toast]);

  const handleChangeAnnotationClass = (newClassId: string) => {
    if (!selectedAnnotationId || !activeImageId) return;

    setBatchImages(prev => 
      prev.map(img => 
        img.id === activeImageId 
          ? { ...img, annotations: img.annotations.map(ann => ann.id === selectedAnnotationId ? { ...ann, classId: newClassId } : ann) } 
          : img
      )
    );

    const updatedClass = annotationClasses.find(ac => ac.id === newClassId);
    toast({
      title: "Annotation Class Changed",
      description: `Annotation class updated to: ${updatedClass?.name || 'Unknown'}`,
    });

    setIsEditClassDialogOpen(false);
  };

  // --- Class Management (Remains Global) ---

  const handleCreateClass = (name: string) => {
    const existingClass = annotationClasses.find(ac => ac.name.toLowerCase() === name.toLowerCase());
    if (existingClass) {
      setSelectedClassIdForToolbar(existingClass.id); 
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
    setSelectedClassIdForToolbar(newClass.id); // Select the newly created class in toolbar
    toast({ title: "Class Created", description: `New class "${name}" added.`});
  };

  const handleSelectClassForToolbar = (classId: string) => {
    setSelectedClassIdForToolbar(classId);
    // Potentially add highlighting logic here later if needed
  };


  // --- UI Interaction Callbacks ---

  const handleSelectAnnotation = useCallback((id: string | null) => {
    setSelectedAnnotationId(id);
    if (id) {
      setCurrentTool('select'); // Switch to select tool when an annotation is clicked
    }
  }, []);


  const handleOpenEditClassDialog = () => {
    if (!selectedAnnotationId) {
      toast({ title: "No Annotation Selected", description: "Please select an annotation to change its class.", variant: "destructive" });
      return;
    }
    setIsEditClassDialogOpen(true);
  };

  // --- Effects ---

  useEffect(() => {
    // Ensure a class is selected in the toolbar if classes exist
    if (!selectedClassIdForToolbar && annotationClasses.length > 0) {
      setSelectedClassIdForToolbar(annotationClasses[0].id);
    } else if (selectedClassIdForToolbar && !annotationClasses.find(ac => ac.id === selectedClassIdForToolbar)) {
      // If the selected class was deleted, select the first available one
      setSelectedClassIdForToolbar(annotationClasses.length > 0 ? annotationClasses[0].id : null);
    }
  }, [annotationClasses, selectedClassIdForToolbar]);

  useEffect(() => {
    // Deselect annotation if switching away from the 'select' tool
    if (currentTool !== 'select' && selectedAnnotationId) {
      setSelectedAnnotationId(null);
    }
  }, [currentTool, selectedAnnotationId]);

  useEffect(() => {
    // Keyboard listener for deleting selected annotation
    const handleKeyDown = (event: KeyboardEvent) => {
      if (selectedAnnotationId && (event.key === 'Delete' || event.key === 'Backspace')) {
        // Prevent browser back navigation on Backspace
        if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
          return; // Don't delete if focused on an input
        }
        event.preventDefault(); 
        handleDeleteSelectedAnnotation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedAnnotationId, handleDeleteSelectedAnnotation]);


  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="bg-primary text-primary-foreground px-6 py-4 shadow-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center">
                 <Leaf className="h-7 w-7 mr-2.5"/>
                 <h1 className="text-2xl font-bold tracking-tight">FieldQuAD</h1>
                 <span className="ml-3 text-xs opacity-90 hidden md:inline">- Batch Annotation</span>
            </div>
            {/* Maybe add user/auth info here later */}
        </div>
      </header>
      
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 md:gap-8 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full lg:w-80 xl:w-96 space-y-6 flex-shrink-0 overflow-y-auto lg:pr-1 custom-scrollbar">
          <ImageUploader 
            onBatchUpload={handleBatchUpload} 
            onImageSelect={handleSelectImageFromBatch}
            onImageRemove={handleRemoveImageFromBatch}
            batchImages={batchImages}
            activeImageId={activeImageId}
          />
          <AnnotationToolbar
            currentTool={currentTool}
            onToolChange={setCurrentTool}
            annotationClasses={annotationClasses}
            onClassCreate={handleCreateClass}
            selectedClassIdForToolbar={selectedClassIdForToolbar} 
            onClassSelectForToolbar={handleSelectClassForToolbar} 
            selectedAnnotationId={selectedAnnotationId}
            onDeleteSelectedAnnotation={handleDeleteSelectedAnnotation}
            onOpenEditClassDialog={handleOpenEditClassDialog}
            isAnnotationSelected={!!selectedAnnotationId}
            canAnnotate={!!activeImageId && annotationClasses.length > 0} // Can draw if image active and classes exist
          />
          <ExportControls
            batchImages={batchImages} // Pass the whole batch
            annotationClasses={annotationClasses}
          />
        </aside>
        
        {/* Main Annotation Area */}
        <section className="flex-1 bg-card p-4 md:p-6 rounded-lg shadow-lg min-h-[300px] md:min-h-[400px] lg:min-h-0 flex flex-col overflow-hidden">
          {activeImageSrc ? (
            <AnnotationCanvas
              imageSrc={activeImageSrc}
              imageDimensions={activeImageDimensions}
              annotations={activeAnnotations}
              currentTool={currentTool}
              annotationClasses={annotationClasses}
              onShapeDrawn={handleShapeDrawn}
              onAnnotationsChange={handleAnnotationsChange}
              selectedAnnotationId={selectedAnnotationId}
              onSelectAnnotation={handleSelectAnnotation}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center h-full border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/10 p-8 text-center">
              <ImageOff className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No Image Selected</p>
              <p className="text-sm text-muted-foreground/80">
                {batchImages.length > 0 
                    ? "Select an image from the batch list to start annotating." 
                    : "Upload one or more images using the panel on the left."}
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Dialog for assigning class to newly drawn shape */}
      <Dialog open={isClassAssignmentDialogOpen} onOpenChange={(isOpen) => {
          setIsClassAssignmentDialogOpen(isOpen);
          if (!isOpen) {
            setPendingShapeData(null); // Clear pending shape if dialog is closed
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
              <ScrollArea className="h-[200px] pr-4 custom-scrollbar">
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

      {/* Dialog for changing class of existing annotation */}
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
              <ScrollArea className="h-[200px] pr-4 custom-scrollbar">
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
