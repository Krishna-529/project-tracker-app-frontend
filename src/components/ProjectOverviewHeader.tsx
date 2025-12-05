import { CheckCircle2, Circle, Settings } from 'lucide-react';
import { useMemo } from 'react';
import { format } from 'date-fns';
import type { Node } from '@/types/node';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProjectOverviewHeaderProps {
  project: Node | null;
  allTasks: Node[];
  onRename?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onNotesChange?: (notes: string) => void;
  onEditDescription?: () => void;
}

export function ProjectOverviewHeader({
  project,
  allTasks,
  onRename,
  onArchive,
  onDelete,
  onNotesChange,
  onEditDescription,
}: ProjectOverviewHeaderProps) {
  const stats = useMemo(() => {
    const total = allTasks.length;
    const completed = allTasks.filter(task => task.status === 'done').length;
    const inProgress = allTasks.filter(task => task.status === 'in_progress').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, progress };
  }, [allTasks]);

  if (!project) {
    return (
      <div className="mb-6 p-6 bg-card rounded-lg border border-border shadow-sm animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">All Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.total} {stats.total === 1 ? 'task' : 'tasks'} across all projects
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{stats.completed}</div>
              <div className="text-xs text-muted-foreground">Done</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-6 bg-card rounded-lg border border-border shadow-sm animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
          {project.meta_description && (
            <p className="text-sm text-muted-foreground mt-2">{project.meta_description}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Notes/Description icon opens modal in main content */}
          <button
            onClick={() => onEditDescription?.()}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'hover:bg-secondary text-muted-foreground hover:text-foreground'
            )}
            title="Notes"
            aria-label="Notes"
          >
            {/* document icon for consistency with header */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
              <path d="M16 13H8"/>
              <path d="M16 17H8"/>
            </svg>
          </button>

          {/* Quick settings dropdown */}
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'p-2 rounded-lg hover:bg-secondary transition-colors',
                'text-muted-foreground hover:text-foreground',
              )}
            >
              <Settings className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onRename && (
              <DropdownMenuItem onClick={onRename}>
                <span>Rename Project</span>
              </DropdownMenuItem>
            )}
            {onArchive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onArchive}>
                  <span>
                    {project.status === 'archived' ? 'Restore Project' : 'Archive Project'}
                  </span>
                </DropdownMenuItem>
              </>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <span>Delete Project</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <Circle className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Total</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
        </div>

        <div className="bg-success/10 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-success mb-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Done</span>
          </div>
          <div className="text-2xl font-bold text-success">{stats.completed}</div>
        </div>

        <div className="bg-warning/10 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-warning mb-1.5">
            <Circle className="w-3.5 h-3.5 fill-current" />
            <span className="text-[11px] font-medium">Active</span>
          </div>
          <div className="text-2xl font-bold text-warning">{stats.inProgress}</div>
        </div>

        <div className="bg-primary/10 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-primary mb-1.5">
            <span className="text-[11px] font-medium">Progress</span>
          </div>
          <div className="text-2xl font-bold text-primary">{stats.progress}%</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            'absolute inset-y-0 left-0 bg-gradient-to-r from-success to-accent rounded-full',
            'transition-all duration-500 ease-out',
          )}
          style={{ width: `${stats.progress}%` }}
        />
      </div>

      {/* Notes section removed (handled in main content) */}
    </div>
  );
}
