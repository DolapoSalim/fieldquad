
"use client";

import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BoxSelect, Brush, PenTool, PlusSquare, Spline, MousePointer2, Palette } from 'lucide-react'; // Added Palette
import type { AnnotationTool, AnnotationClass } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AnnotationToolbarProps {
  currentTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  annotationClasses: AnnotationClass[];
  onClassCreate: (name: string) => void;
  selectedClassId: string | null;
  onClassSelect: (classId: string) => void;
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
  selectedClassId,
  onClassSelect,
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
        <CardTitle>Tools & Classes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="annotation-tool-select" className="mb-2 block text-sm font-medium">Annotation Tool</Label>
          <Select value={currentTool} onValueChange={(value) => onToolChange(value as AnnotationTool)}>
            <SelectTrigger id="annotation-tool-select">
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

        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center">
            <Palette size={16} className="mr-2 text-primary" /> Annotation Classes
          </Label>
          <ScrollArea className="h-40 w-full rounded-md border p-2">
            {annotationClasses.length > 0 ? (
              <div className="space-y-1">
                {annotationClasses.map((ac) => (
                  <Button
                    key={ac.id}
                    variant={selectedClassId === ac.id ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start text-left h-auto py-1.5 px-2"
                    onClick={() => onClassSelect(ac.id)}
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
            <Input
              type="text"
              placeholder="New class name"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="text-sm h-9"
            />
            <Button onClick={handleCreateClass} variant="secondary" className="w-full h-9">
              <PlusSquare className="mr-2 h-4 w-4 shrink-0" /> Add New Class
            </Button>
          </div>
           {selectedClassId && annotationClasses.find(ac => ac.id === selectedClassId) && (
            <p className="mt-1 text-xs text-muted-foreground">
              Selected: <span className="font-semibold truncate">{annotationClasses.find(ac => ac.id === selectedClassId)?.name}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
