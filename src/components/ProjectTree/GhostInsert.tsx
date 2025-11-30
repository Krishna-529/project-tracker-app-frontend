import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GhostInsertProps {
  onInsert: () => void;
  parentId: number | null;
}

export const GhostInsert = ({ onInsert }: GhostInsertProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0 }}
      transition={{ duration: 0.15 }}
      className="relative h-6 flex items-center group"
    >
      {/* The ghost line */}
      <div className="absolute inset-x-4 h-[2px] bg-primary/30 rounded-full" />

      {/* Insert button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onInsert();
        }}
        className={cn(
          'absolute left-1/2 -translate-x-1/2',
          'w-6 h-6 rounded-full',
          'bg-primary text-primary-foreground',
          'flex items-center justify-center',
          'opacity-0 group-hover:opacity-100',
          'transition-opacity duration-150',
          'scale-press',
          'shadow-lg'
        )}
      >
        <Plus className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
