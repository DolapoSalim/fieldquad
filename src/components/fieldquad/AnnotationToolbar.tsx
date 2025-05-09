
"use client";

import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BoxSelect, Brush, PenTool, PlusSquare, Spline, MousePointer2, Palette, Trash2 } from 'lucide-react';
import type { AnnotationTool, AnnotationClass } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface AnnotationToolbarProps {
  currentTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  annotationClasses: AnnotationClass[];
  onClassCreate: (name: string) => void;
  selectedClassIdForNewAnnotation: string | null; 
  onClassSelectForToolbar: (classId: string) => void; 
  selectedAnnotationId: string | null; 
  onDeleteSelectedAnnotation: () => void; 
  onOpenEditClassDialog: () => void; // New prop
}

const toolIcons: Record<AnnotationTool, React.ElementType> = {
  select: MousePointer2,
  bbox: BoxSelect,
  polygon: Spline,
  freehand: Brush,
};

const toolNames: Record<AnnotationTool, string> = {
  select: 'Select/Move',
  bbox: 'Bounding Box',
  polygon: 'Polygon',
  freehand: 'Freehand',
};

export function AnnotationToolbar({
  currentTool,
  onToolChange,
  annotationClasses,
  onClassCreate,
  selectedClassIdForNewAnnotation,
  onClassSelectForToolbar,
  selectedAnnotationId,
  onDeleteSelectedAnnotation,
  onOpenEditClassDialog, 
}: AnnotationToolbarProps): JSX.Element {
  const [newClassName, setNewClassName] = useState('');

  const handleCreateClass = () => {
    if (newClassName.trim()) {
      onClassCreate(newClassName.trim());
      setNewClassName('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Tools & Classes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="annotation-tool-select" className="mb-2 block text-sm font-medium">Annotation Tool</Label>
          <Select value={currentTool} onValueChange={(value) => onToolChange(value as AnnotationTool)}>
            <SelectTrigger id="annotation-tool-select" className="bg-background">
              <SelectValue placeholder="Select an annotation tool" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(toolIcons) as AnnotationTool[]).map((tool) => {
                const Icon = toolIcons[tool];
                return (
                  <SelectItem key={tool} value={tool}>
                    <div className="flex items-center">
                      <Icon className="mr-2 h-4 w-4 shrink-0" />
                      <span>{toolNames[tool]}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {currentTool === 'select' && selectedAnnotationId && (
          <div className="space-y-2 pt-2">
             <Label className="text-sm font-medium">Selected Annotation</Label>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={onOpenEditClassDialog}
              disabled={!selectedAnnotationId}
            >
              <Palette className="mr-2 h-4 w-4 shrink-0" /> Change Class
            </Button>
            <Button 
              variant="destructive" 
              className="w-full" 
              onClick={onDeleteSelectedAnnotation}
              disabled={!selectedAnnotationId}
            >
              <Trash2 className="mr-2 h-4 w-4 shrink-0" /> Delete Selected
            </Button>
             <p className="mt-1 text-xs text-muted-foreground text-center">
              (Or press Delete/Backspace key)
            </p>
          </div>
        )}
        
        <Separator />

        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center">
            <Palette size={16} className="mr-2 text-primary" /> Annotation Classes
          </Label>
          <p className="text-xs text-muted-foreground">
            Select a class to highlight its annotations or create new classes below. New annotations will prompt for class selection after drawing.
          </p>
          <ScrollArea className="h-40 w-full rounded-md border p-2 custom-scrollbar">
            {annotationClasses.length > 0 ? (
              <div className="space-y-1">
                {annotationClasses.map((ac) => (
                  <Button
                    key={ac.id}
                    variant={selectedClassIdForNewAnnotation === ac.id ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start text-left h-auto py-1.5 px-2"
                    onClick={() => onClassSelectForToolbar(ac.id)}
                  >
                    <span style={{ backgroundColor: ac.color }} className="mr-2 h-3 w-3 rounded-full inline-block border border-foreground/20 shrink-0"></span>
                    <span className="truncate flex-1 min-w-0">{ac.name}</span>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center p-2">No classes created yet. Add a class below.</p>
            )}
          </ScrollArea>
         
          <div className="space-y-2 pt-2">
            <Label htmlFor="new-class-name-input" className="text-sm font-medium">Add New Class</Label>
            <Input
              id="new-class-name-input"
              type="text"
              placeholder="Enter class name"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="text-sm h-9 bg-background"
            />
            <Button onClick={handleCreateClass} variant="secondary" className="w-full h-9">
              <PlusSquare className="mr-2 h-4 w-4 shrink-0" /> Create Class
            </Button>
          </div>
           {selectedClassIdForNewAnnotation && annotationClasses.find(ac => ac.id === selectedClassIdForNewAnnotation) && (
            <p className="mt-1 text-xs text-muted-foreground">
              Highlighting annotations for: <span className="font-semibold truncate">{annotationClasses.find(ac => ac.id === selectedClassIdForNewAnnotation)?.name}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
