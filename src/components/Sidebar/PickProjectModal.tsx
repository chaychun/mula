"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Project } from "@/lib/types";

interface PickProjectModalProps {
  isOpen: boolean;
  projects: Project[];
  onClose: () => void;
  onPick: (projectId: string) => void;
}

export default function PickProjectModal({
  isOpen,
  projects,
  onClose,
  onPick,
}: PickProjectModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pick a project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => {
                onPick(project.id);
                onClose();
              }}
              className="text-left px-3 py-2 text-[13px] outline-none transition-colors hover:bg-sidebar-accent/20 focus-visible:bg-sidebar-accent/30 focus-visible:ring-1 focus-visible:ring-foreground/40 focus-visible:ring-inset"
            >
              {project.name}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
