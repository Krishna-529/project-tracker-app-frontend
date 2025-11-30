import { useState } from 'react';
import { Plus, FolderPlus, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export const BottomAddMenu = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleAddTask = () => {
    console.log('Add task');
    setShowMenu(false);
  };

  const handleAddProject = () => {
    console.log('Add project');
    setShowMenu(false);
  };

  return (
    <div className="relative px-4 py-2">
      <div
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setTimeout(() => setShowMenu(false), 100);
        }}
      >
        {/* Main Add Button */}
        <button
          onClick={handleAddTask}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2',
            'text-sm text-muted-foreground hover:text-foreground',
            'hover:bg-muted/50 rounded-md transition-all scale-press'
          )}
        >
          <div 
            className="relative"
            onMouseEnter={() => setShowMenu(true)}
          >
            <Plus className="w-4 h-4" />
          </div>
          <span>Add task</span>
        </button>

        {/* Hover Menu */}
        <AnimatePresence>
          {(isHovered || showMenu) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute bottom-full left-4 mb-1',
                'bg-card border border-border rounded-lg shadow-lg',
                'overflow-hidden z-50'
              )}
            >
              <button
                onClick={handleAddTask}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5',
                  'text-sm text-foreground hover:bg-muted',
                  'transition-colors text-left'
                )}
              >
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>Add task</span>
              </button>
              <div className="h-[1px] bg-border" />
              <button
                onClick={handleAddProject}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5',
                  'text-sm text-foreground hover:bg-muted',
                  'transition-colors text-left'
                )}
              >
                <FolderPlus className="w-4 h-4 text-muted-foreground" />
                <span>Add project</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
