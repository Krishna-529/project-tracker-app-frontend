import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar } from 'lucide-react';
import { Node } from '@/types/node';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TaskCardProps {
  node: Node;
  onClose: () => void;
  depth: number;
}

const springConfig = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

export const TaskCard = ({ node, onClose, depth }: TaskCardProps) => {
  const [name, setName] = useState(node.name);
  const [description, setDescription] = useState(node.meta_description || '');
  const [notes, setNotes] = useState(node.notes || '');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const indentPx = depth * 24;

  useEffect(() => {
    // Auto-focus name input when card opens
    setTimeout(() => nameInputRef.current?.focus(), 100);
  }, []);

  const handleSave = () => {
    // TODO: Trigger mutation to save changes
    console.log('Save:', { name, description, notes });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <motion.div
      layoutId={`task-${node.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={springConfig}
      className={cn(
        'bg-card border border-border rounded-lg shadow-xl',
        'absolute left-0 right-0 z-20',
        'backdrop-blur-sm'
      )}
      style={{ marginLeft: indentPx }}
      onKeyDown={handleKeyDown}
    >
      <div className="p-6 space-y-4">
        {/* Header with close button */}
        <div className="flex items-start justify-between gap-4">
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(
              'text-2xl font-bold bg-transparent border-none outline-none',
              'text-foreground placeholder:text-muted-foreground',
              'w-full'
            )}
            placeholder="Task name..."
          />
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 hover:bg-muted rounded scale-press"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={cn(
              'w-full px-3 py-2 bg-muted/50 border border-border rounded-md',
              'text-sm text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/20'
            )}
            placeholder="Add a description..."
          />
        </div>

        {/* Deadline */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">
            Deadline
          </label>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-md">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {node.deadline ? format(new Date(node.deadline), 'PPP') : 'No deadline'}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={cn(
              'w-full px-3 py-2 bg-muted/50 border border-border rounded-md',
              'text-sm text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/20',
              'resize-none'
            )}
            placeholder="Add notes..."
          />
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 text-sm font-medium',
              'text-foreground bg-muted hover:bg-muted/80',
              'rounded-md transition-colors scale-press'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={cn(
              'px-4 py-2 text-sm font-medium',
              'text-primary-foreground bg-primary hover:bg-primary/90',
              'rounded-md transition-colors scale-press'
            )}
          >
            Save Changes
          </button>
        </div>
      </div>
    </motion.div>
  );
};
