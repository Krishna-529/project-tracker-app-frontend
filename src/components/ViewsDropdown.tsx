import { LayoutGrid, List, Columns3, Calendar, GanttChart, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ViewMode = 'list' | 'kanban' | 'calendar' | 'timeline' | 'completed' | 'pending';

interface ViewsDropdownProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const VIEW_OPTIONS = [
  {
    id: 'list' as ViewMode,
    label: 'List View',
    description: 'Classic hierarchical list',
    icon: List,
    available: true,
  },
  {
    id: 'kanban' as ViewMode,
    label: 'Kanban Board',
    description: 'Visual board with columns',
    icon: Columns3,
    available: false, // Coming soon
  },
  {
    id: 'calendar' as ViewMode,
    label: 'Calendar View',
    description: 'See tasks by due date',
    icon: Calendar,
    available: false, // Coming soon
  },
  {
    id: 'timeline' as ViewMode,
    label: 'Timeline / Gantt',
    description: 'Project timeline view',
    icon: GanttChart,
    available: false, // Coming soon
  },
] as const;

const FILTER_OPTIONS = [
  {
    id: 'pending' as ViewMode,
    label: 'Pending Only',
    description: 'Show incomplete tasks',
    icon: Clock,
    available: true,
  },
  {
    id: 'completed' as ViewMode,
    label: 'Completed Only',
    description: 'Show finished tasks',
    icon: CheckCircle2,
    available: true,
  },
] as const;

export function ViewsDropdown({ currentView, onViewChange }: ViewsDropdownProps) {
  const currentViewOption = [...VIEW_OPTIONS, ...FILTER_OPTIONS].find(v => v.id === currentView);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'px-3 py-1.5 text-sm font-medium',
            'text-foreground bg-secondary/50 hover:bg-secondary',
            'border border-border hover:border-accent/30',
            'rounded-md transition-all scale-press',
            'flex items-center gap-2',
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>{currentViewOption?.label || 'Views'}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>View Mode</DropdownMenuLabel>
        {VIEW_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => option.available && onViewChange(option.id)}
              disabled={!option.available}
              className={cn(
                'flex items-start gap-3 p-3 cursor-pointer',
                currentView === option.id && 'bg-accent/10 text-accent',
                !option.available && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {option.label}
                  {!option.available && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full">
                      Coming Soon
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
              </div>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Filters</DropdownMenuLabel>
        {FILTER_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => option.available && onViewChange(option.id)}
              disabled={!option.available}
              className={cn(
                'flex items-start gap-3 p-3 cursor-pointer',
                currentView === option.id && 'bg-accent/10 text-accent',
                !option.available && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
              </div>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <button
          onClick={() => onViewChange('list')}
          className="w-full px-2 py-1.5 text-sm text-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
        >
          Reset to List View
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
