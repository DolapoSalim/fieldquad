
"use client";

import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BoxSelect, Brush, PenTool, PlusSquare, Spline, MousePointer2, Palette, Trash2, Hand, Pencil } from 'lucide-react'; // Added Hand, Pencil icon
import type { AnnotationTool, AnnotationClass } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components

interface AnnotationToolbarProps {
  currentTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  annotationClasses: AnnotationClass[];
  onClassCreate: (name: string) => void;
  selectedClassIdForToolbar: string | null; // Renamed for clarity
  onClassSelectForToolbar: (classId: string) => void;
  onClassDelete: (classId: string) => void; // Added prop for deleting class
  onClassRename: (classId: string) => void; // Added prop for initiating rename
  selectedAnnotationId: string | null; // ID of annotation selected on canvas
  onDeleteSelectedAnnotation: () => void;
  onOpenEditClassDialog: () => void;
  isAnnotationSelected: boolean; // Pass boolean for easier disabling
  canAnnotate: boolean; // Indicates if an image is active and classes exist
  activeImageId: string | null; // Added missing prop
}

const toolIcons: Record<AnnotationTool, React.ElementType> = {
  select: MousePointer2,
  pan: Hand, // Added Pan tool icon
  bbox: BoxSelect,
  polygon: Spline,
  freehand: Brush,
};

const toolNames: Record<AnnotationTool, string> = {
  select: 'Select/Move Annotation',
  pan: 'Pan Canvas', // Added Pan tool name
  bbox: 'Bounding Box',
  polygon: 'Polygon',
  freehand: 'Freehand',
};

export function AnnotationToolbar({
  currentTool,
  onToolChange,
  annotationClasses,
  onClassCreate,
  selectedClassIdForToolbar,
  onClassSelectForToolbar,
  onClassDelete, // Receive handler
  onClassRename, // Receive handler
  selectedAnnotationId, // Keep for potential future use (e.g., showing selected annotation details)
  onDeleteSelectedAnnotation,
  onOpenEditClassDialog,
  isAnnotationSelected,
  canAnnotate,
  activeImageId, // Added prop
}: AnnotationToolbarProps): JSX.Element {
  const [newClassName, setNewClassName] = useState('');

  const handleCreateClass = () => {
    if (newClassName.trim()) {
      onClassCreate(newClassName.trim());
      setNewClassName('');
    }
  };

  // Disable drawing tools if no active image or no classes
  const drawingToolsDisabled = !canAnnotate;
  // Select/Pan tools are always enabled if an image is loaded
  const nonDrawingToolsDisabled = !activeImageId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Tools & Classes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Annotation Tool Selection */}
        <div>
          <Label htmlFor="annotation-tool-select" className="mb-2 block text-sm font-medium">Canvas Tool</Label>
          <Select
            value={currentTool}
            onValueChange={(value) => onToolChange(value as AnnotationTool)}
            disabled={nonDrawingToolsDisabled} // Disable dropdown if no image loaded
          >
            <SelectTrigger id="annotation-tool-select" className="bg-background">
              <SelectValue placeholder="Select a tool" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(toolIcons) as AnnotationTool[]).map((tool) => {
                const Icon = toolIcons[tool];
                const isDrawingTool = tool === 'bbox' || tool === 'polygon' || tool === 'freehand';
                const isDisabled = nonDrawingToolsDisabled || (isDrawingTool && drawingToolsDisabled);
                return (
                  <SelectItem key={tool} value={tool} disabled={isDisabled}>
                    <div className="flex items-center">
                      <Icon className="mr-2 h-4 w-4 shrink-0" />
                      <span>{toolNames[tool]}</span>
                      {tool === 'pan' && <span className="ml-auto text-xs text-muted-foreground">(or Middle-Click)</span>}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
           {drawingToolsDisabled && (currentTool === 'bbox' || currentTool === 'polygon' || currentTool === 'freehand') && (
             <p className="mt-1 text-xs text-destructive">
               Upload an image and create a class to enable drawing tools.
             </p>
           )}
           {nonDrawingToolsDisabled && (
              <p className="mt-1 text-xs text-muted-foreground">
                Upload an image to enable tools.
              </p>
           )}
        </div>

        {/* Selected Annotation Actions (only visible/enabled when select tool is active and annotation selected) */}
         {currentTool === 'select' && !nonDrawingToolsDisabled && (
          <div className="space-y-2 pt-2 border-t border-border mt-4">
             <Label className="text-sm font-medium text-muted-foreground">Selected Annotation Actions</Label>
            <Button
              variant="outline"
              className="w-full"
              onClick={onOpenEditClassDialog}
              disabled={!isAnnotationSelected}
            >
              <Palette className="mr-2 h-4 w-4 shrink-0" /> Change Class
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={onDeleteSelectedAnnotation}
              disabled={!isAnnotationSelected}
            >
              <Trash2 className="mr-2 h-4 w-4 shrink-0" /> Delete Selected
            </Button>
             {isAnnotationSelected && (
               <p className="mt-1 text-xs text-muted-foreground text-center">
                (Or press Delete/Backspace key)
               </p>
             )}
             {!isAnnotationSelected && (
                <p className="mt-1 text-xs text-muted-foreground text-center">
                 Click an annotation on the canvas to select it.
                </p>
             )}
          </div>
         )}

        {/* Annotation Classes */}
        <div className="space-y-3 pt-4 border-t border-border">
          <Label className="text-sm font-medium flex items-center">
            <Palette size={16} className="mr-2 text-primary" /> Annotation Classes
          </Label>
          <p className="text-xs text-muted-foreground">
            Manage classes below. New annotations will prompt for class selection after drawing.
          </p>
          <ScrollArea className="h-32 w-full rounded-md border p-2 custom-scrollbar bg-background/50">
            <TooltipProvider delayDuration={300}>
             {annotationClasses.length > 0 ? (
                <div className="space-y-1">
                  {annotationClasses.map((ac) => (
                    <div key={ac.id} className="flex items-center justify-between group">
                        <Button
                          variant={selectedClassIdForToolbar === ac.id ? 'secondary' : 'ghost'}
                          size="sm"
                          className="flex-1 justify-start text-left h-auto py-1.5 px-2 mr-1" // Added mr-1 for spacing
                          onClick={() => onClassSelectForToolbar(ac.id)}
                        >
                          <span style={{ backgroundColor: ac.color }} className="mr-2 h-3 w-3 rounded-full inline-block border border-foreground/20 shrink-0"></span>
                          <span className="truncate flex-1 min-w-0">{ac.name}</span>
                        </Button>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={(e) => { e.stopPropagation(); onClassRename(ac.id); }}
                                    aria-label={`Rename class ${ac.name}`}
                                >
                                    <Pencil size={14} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Rename Class</TooltipContent>
                          </Tooltip>
                           <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => { e.stopPropagation(); onClassDelete(ac.id); }}
                                    aria-label={`Delete class ${ac.name}`}
                                >
                                    <Trash2 size={14} />
                                </Button>
                           </TooltipTrigger>
                           <TooltipContent side="top">Delete Class</TooltipContent>
                          </Tooltip>
                        </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center p-2">No classes created yet. Add a class below.</p>
              )}
             </TooltipProvider>
          </ScrollArea>

          <div className="space-y-2 pt-2">
            <Label htmlFor="new-class-name-input" className="text-sm font-medium">Add New Class</Label>
            <div className="flex space-x-2">
              <Input
                id="new-class-name-input"
                type="text"
                placeholder="Enter class name"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateClass()}
                className="text-sm h-9 bg-background flex-1"
              />
              <Button onClick={handleCreateClass} variant="secondary" className="h-9 px-3" disabled={!newClassName.trim()}>
                <PlusSquare className="h-4 w-4 shrink-0" />
                <span className="ml-2 hidden sm:inline">Add</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

