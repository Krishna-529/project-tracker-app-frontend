import { useState } from 'react';
import { Node } from '@/types/node';
import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ExplorerPanelProps {
  nodes: Node[];
  selectedProjectId: number | null;
  onSelectProject: (projectId: number | null) => void;
  depth?: number;
}

export const ExplorerPanel = ({ 
  nodes, 
  selectedProjectId, 
  onSelectProject,
  depth = 0 
}: ExplorerPanelProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set([1, 5]));

  const toggleExpanded = (nodeId: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleProjectClick = (node: Node) => {
    if (!node.is_task) {
      toggleExpanded(node.id);
      onSelectProject(node.id);
    }
  };

  // Only show projects (folders) in the explorer
  const projectNodes = nodes.filter(node => !node.is_task);

  return (
    <div className="space-y-0.5">
      {projectNodes.map((node) => {
        const isExpanded = expandedIds.has(node.id);
        const isSelected = selectedProjectId === node.id;
        const hasChildren = node.children && node.children.some(child => !child.is_task);

        return (
          <div key={node.id}>
            <button
              onClick={() => handleProjectClick(node)}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-1 text-sm',
                'hover:bg-muted/50 rounded-sm transition-colors',
                'text-left group',
                isSelected && 'bg-muted text-primary font-medium'
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {/* Chevron */}
              {hasChildren && (
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </motion.div>
              )}
              
              {/* Spacer if no children */}
              {!hasChildren && <div className="w-3.5" />}

              {/* Folder icon */}
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}

              {/* Project name */}
              <span className="truncate flex-1">{node.name}</span>
            </button>

            {/* Render children */}
            <AnimatePresence initial={false}>
              {isExpanded && node.children && node.children.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="overflow-hidden"
                >
                  <ExplorerPanel
                    nodes={node.children}
                    selectedProjectId={selectedProjectId}
                    onSelectProject={onSelectProject}
                    depth={depth + 1}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};
