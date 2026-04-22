"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, FolderOpen } from "lucide-react";
import type { ModuleOut } from "@/lib/api";

interface SortableModuleProps {
  module: ModuleOut;
  onDelete: (id: string) => void;
  onClick: (id: string) => void;
}

function SortableModule({ module, onDelete, onClick }: SortableModuleProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="glass-card p-4 flex items-center gap-3">
      <button {...attributes} {...listeners} className="cursor-grab text-dark-400 hover:text-dark-200">
        <GripVertical className="w-5 h-5" />
      </button>
      <div className="flex-1 cursor-pointer" onClick={() => onClick(module.id)}>
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-accent-purple" />
          <h3 className="text-sm font-semibold text-white">{module.title}</h3>
        </div>
        {module.description && (
          <p className="text-xs text-dark-400 mt-1 ml-6">{module.description}</p>
        )}
        <p className="text-xs text-dark-400 mt-1 ml-6">{module.items.length} item{module.items.length !== 1 ? "s" : ""}</p>
      </div>
      <button onClick={() => onDelete(module.id)} className="text-dark-400 hover:text-red-400 transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

interface CmsBuilderProps {
  modules: ModuleOut[];
  onReorder: (newOrder: string[]) => void;
  onDelete: (moduleId: string) => void;
  onModuleClick: (moduleId: string) => void;
  onAdd: () => void;
}

export default function CmsBuilder({ modules, onReorder, onDelete, onModuleClick, onAdd }: CmsBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(modules, oldIndex, newIndex);
    onReorder(reordered.map((m) => m.id));
  };

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {modules.map((m) => (
            <SortableModule
              key={m.id}
              module={m}
              onDelete={onDelete}
              onClick={onModuleClick}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={onAdd}
        className="w-full glass-card p-4 flex items-center justify-center gap-2 text-dark-300 hover:text-white hover:border-accent-purple/30 transition-colors"
      >
        <Plus className="w-4 h-4" /> Add Module
      </button>
    </div>
  );
}
