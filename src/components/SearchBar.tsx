import { Search, X, Filter, Clock } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  filters?: SearchFilters;
  onFiltersChange?: (filters: SearchFilters) => void;
  placeholder?: string;
}

export interface SearchFilters {
  status?: 'todo' | 'in_progress' | 'done' | 'archived';
  hasDeadline?: boolean;
}

const RECENT_SEARCHES_KEY = 'project-tracker-recent-searches';
const MAX_RECENT_SEARCHES = 5;

export function SearchBar({ value, onChange, filters = {}, onFiltersChange, placeholder = 'Search...' }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse recent searches:', e);
      }
    }
  }, []);

  // Save search to recent
  const saveToRecent = (search: string) => {
    if (!search.trim()) return;

    const updated = [search, ...recentSearches.filter(s => s !== search)].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const handleChange = (newValue: string) => {
    onChange(newValue);
    if (newValue.length > 0) {
      setShowRecent(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      saveToRecent(value);
      setShowRecent(false);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      onChange('');
      inputRef.current?.blur();
    }
  };

  const handleFilterChange = (newFilters: SearchFilters) => {
    onFiltersChange?.(newFilters);
  };

  const activeFilterCount = (filters.status ? 1 : 0) + (filters.hasDeadline !== undefined ? 1 : 0);

  return (
    <div className="relative">
      <div
        className={cn(
          'flex items-center gap-2 px-3.5 h-10 w-[420px] bg-card border rounded-xl transition-all duration-200',
          isFocused
            ? 'border-primary ring-2 ring-primary/20 shadow-sm'
            : 'border-border/40 hover:border-primary/50',
        )}
      >
        <Search className={cn('w-4 h-4 transition-colors', isFocused ? 'text-primary' : 'text-muted-foreground')} />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (!value && recentSearches.length > 0) {
              setShowRecent(true);
            }
          }}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setShowRecent(false), 200);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        {value && (
          <button
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="p-1 hover:bg-secondary rounded transition-colors"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'p-1 rounded transition-colors relative',
                activeFilterCount > 0 ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-muted-foreground',
              )}
            >
              <Filter className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={filters.status === 'todo'}
              onCheckedChange={(checked) => {
                handleFilterChange({ ...filters, status: checked ? 'todo' : undefined });
              }}
            >
              To Do
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.status === 'in_progress'}
              onCheckedChange={(checked) => {
                handleFilterChange({ ...filters, status: checked ? 'in_progress' : undefined });
              }}
            >
              In Progress
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.status === 'done'}
              onCheckedChange={(checked) => {
                handleFilterChange({ ...filters, status: checked ? 'done' : undefined });
              }}
            >
              Done
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter by Deadline</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={filters.hasDeadline === true}
              onCheckedChange={(checked) => {
                handleFilterChange({ ...filters, hasDeadline: checked ? true : undefined });
              }}
            >
              Has Deadline
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.hasDeadline === false}
              onCheckedChange={(checked) => {
                handleFilterChange({ ...filters, hasDeadline: checked ? false : undefined });
              }}
            >
              No Deadline
            </DropdownMenuCheckboxItem>
            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <button
                  onClick={() => handleFilterChange({})}
                  className="w-full px-2 py-1.5 text-sm text-center text-accent hover:bg-accent/10 rounded transition-colors"
                >
                  Clear All Filters
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Recent searches dropdown */}
      {showRecent && recentSearches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 animate-slide-down">
          <div className="p-2">
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Recent Searches</span>
            </div>
            {recentSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => {
                  onChange(search);
                  setShowRecent(false);
                  inputRef.current?.focus();
                }}
                className="w-full text-left px-2 py-1.5 text-sm text-foreground hover:bg-secondary rounded transition-colors"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Utility to highlight search matches in text
export function highlightSearchMatch(text: string, query: string) {
  if (!query.trim()) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-warning/30 text-foreground rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
