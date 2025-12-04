import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Circle, CheckCircle2, Folder, FolderOpen, FileText } from 'lucide-react';
import { Node } from '@/types/node';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface NodeRowProps {
  node: Node;
  depth: number;
}

const springConfig = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

export const NodeRow = ({ node, depth }: NodeRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCompleted, setIsCompleted] = useState(node.status === 'done');

  // Calculate completion stats for projects
  const completionStats = useMemo(() => {
    if (node.is_task || !node.children) return null;
    
    const tasks = node.children.filter(child => child.is_task);
    const completed = tasks.filter(task => task.status === 'done').length;
    const total = tasks.length;
    
    return { completed, total, percentage: total > 0 ? (completed / total) * 100 : 0 };
  }, [node]);

  const handleCheckboxToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCompleted(!isCompleted);
    // TODO: Trigger mutation to update status
  };

  const handleRowClick = () => {
    if (node.is_task && (!node.children || node.children.length === 0)) {
      setIsEditMode(!isEditMode);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  // Indent calculation
  const indentPx = depth * 24;

  return (
    <>
      <motion.div
        layout="position"
        initial={false}
        className={cn(
          'relative group cursor-pointer hover-surface task-row-guideline',
          isEditMode && 'z-20'
        )}
        onClick={handleRowClick}
      >
        {/* Guide lines for depth visualization */}
        {depth > 0 && (
          <div className="absolute left-0 top-0 bottom-0 flex">
            {Array.from({ length: depth }).map((_, i) => (
              <div
                key={i}
                className="tree-guide-line"
                style={{ marginLeft: i === 0 ? 0 : 24, width: 1 }}
              />
            ))}
          </div>
        )}

        {/* Compact Row State */}
        <motion.div
          layout="position"
          className={cn(
            'flex items-center gap-2 px-4 py-2 transition-all',
            isEditMode && 'opacity-0 h-0 overflow-hidden'
          )}
          style={{ paddingLeft: indentPx + 16 }}
        >
          {/* Folder/Task Icon */}
          {!node.is_task ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={springConfig}
              >
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              </motion.div>
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-primary" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0">
              {node.children && node.children.length > 0 && (
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={springConfig}
                >
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                </motion.div>
              )}
              <button
                onClick={handleCheckboxToggle}
                className="scale-press"
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-primary animate-checkboxPop" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              <FileText className="w-3.5 h-3.5 text-muted-foreground/60" />
            </div>
          )}

          {/* Name */}
          <span
            className={cn(
              'text-sm flex-1 truncate transition-all',
              node.is_task ? 'text-foreground' : 'font-semibold text-foreground',
              isCompleted && 'line-through text-muted-foreground'
            )}
          >
            {node.name}
          </span>

          {/* Subtasks indicator for tasks with children */}
          {node.is_task && node.children && node.children.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs font-medium">
              <span className="text-[10px]">📋</span>
              <span>{node.children.filter(c => c.status === 'done').length}/{node.children.length}</span>
            </div>
          )}

          {/* Deadline Badge */}
          {node.is_task && node.deadline && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {format(new Date(node.deadline), 'MMM d')}
            </span>
          )}

          {/* Completion indicator for projects */}
          {!node.is_task && completionStats && completionStats.total > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {completionStats.completed}/{completionStats.total}
              </span>
              <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${completionStats.percentage}%` }}
                  transition={springConfig}
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Expanded Card State */}
        <AnimatePresence>
          {isEditMode && (
            <TaskCard
              node={node}
              onClose={() => setIsEditMode(false)}
              depth={depth}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Children (for folders and tasks with subtasks) */}
      <AnimatePresence initial={false}>
        {isExpanded && node.children && node.children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springConfig}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <NodeRow key={child.id} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
