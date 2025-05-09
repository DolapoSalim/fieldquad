
"use client";

import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BoxSelect, Brush, PenTool, PlusSquare, Spline, MousePointer2 } from 'lucide-react';
import type { AnnotationTool, AnnotationClass } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AnnotationToolbarProps {
  currentTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  annotationClasses: AnnotationClass[];
  onClassCreate: (name: string) => void;
  selectedClassId: string | null; // Used to show current selection in dropdown
  onClassSelect: (classId: string) => void; // Used to update selectedClassId for other purposes (e.g. filtering)
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
          <Label className="mb-2 block text-sm font-medium">Annotation Tool</Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(toolIcons) as AnnotationTool[]).map((tool) => {
              const Icon = toolIcons[tool];
              return (
                <Button
                  key={tool}
                  variant={currentTool === tool ? 'default' : 'outline'}
                  onClick={() => onToolChange(tool)}
                  className="flex items-center justify-start text-left whitespace-nowrap"
                  title={toolNames[tool]}
                >
                  <Icon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{toolNames[tool]}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <div>
          <Label htmlFor="annotation-class-select" className="mb-2 block text-sm font-medium">
            Annotation Classes
          </Label>
          {annotationClasses.length > 0 && (
             <Select value={selectedClassId ?? undefined} onValueChange={onClassSelect}>
              <SelectTrigger id="annotation-class-select">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="h-40">
                {annotationClasses.map((ac) => (
                  <SelectItem key={ac.id} value={ac.id}>
                    <div className="flex items-center">
                      <span style={{ backgroundColor: ac.color }} className="mr-2 h-3 w-3 rounded-full inline-block border border-foreground/20 shrink-0"></span>
                      <span className="truncate">{ac.name}</span>
                    </div>
                  </SelectItem>
                ))}
                </ScrollArea>
              </SelectContent>
            </Select>
          )}
         
          <div className="mt-2 space-y-2">
            <Input
              type="text"
              placeholder="New class name (e.g., Rock Type A)"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="text-sm"
            />
            <Button onClick={handleCreateClass} variant="secondary" className="w-full">
              <PlusSquare className="mr-2 h-4 w-4 shrink-0" /> Add New Class
            </Button>
          </div>
           {selectedClassId && annotationClasses.find(ac => ac.id === selectedClassId) && (
            <p className="mt-2 text-xs text-muted-foreground">
              Current class for filtering/viewing: <span className="font-semibold truncate">{annotationClasses.find(ac => ac.id === selectedClassId)?.name}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
