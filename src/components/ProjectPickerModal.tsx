import { useState, useMemo } from 'react';
import { Folder, FolderOpen, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Node } from '@/types/node';

interface ProjectPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProjects: Node[];
  onSelectProject: (nodeId: number) => void;
  onCloseProject?: () => void;
}

export function ProjectPickerModal({ isOpen, onClose, allProjects, onSelectProject, onCloseProject }: ProjectPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState<Node[]>([]);
  const [currentProjects, setCurrentProjects] = useState<Node[]>(allProjects);

  // Update current projects when modal opens or allProjects change
  useMemo(() => {
    if (isOpen) {
      setCurrentProjects(allProjects);
      setCurrentPath([]);
    }
  }, [isOpen, allProjects]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return currentProjects;

    const query = searchQuery.toLowerCase();
    const matchingNodes: Node[] = [];

    const searchNode = (node: Node): boolean => {
      const matches = node.name.toLowerCase().includes(query);
      let hasMatchingChild = false;

      if (node.children) {
        node.children.forEach(child => {
          if (!child.is_task && searchNode(child)) {
            hasMatchingChild = true;
          }
        });
      }

      if (matches || hasMatchingChild) {
        matchingNodes.push(node);
        if (hasMatchingChild) {
          setExpandedIds(prev => new Set(prev).add(node.id));
        }
        return true;
      }

      return false;
    };

    currentProjects.forEach(searchNode);
    return matchingNodes;
  }, [currentProjects, searchQuery]);

  const toggleExpand = (nodeId: number) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleSelect = (nodeId: number) => {
    setSelectedId(nodeId);
  };

  const handleOpen = () => {
    if (selectedId !== null) {
      onSelectProject(selectedId);
      onClose();
      setSearchQuery('');
      setExpandedIds(new Set());
      setSelectedId(null);
    }
  };

  const handleClose = () => {
    onClose();
    setSearchQuery('');
    setExpandedIds(new Set());
    setSelectedId(null);
    setCurrentPath([]);
    setCurrentProjects(allProjects);
  };

  const handleNavigateInto = (project: Node) => {
    const subProjects = project.children?.filter(child => !child.is_task) ?? [];
    if (subProjects.length > 0) {
      setCurrentPath([...currentPath, project]);
      setCurrentProjects(subProjects);
      setSelectedId(null);
      setExpandedIds(new Set());
    }
  };

  const handleNavigateBack = () => {
    if (currentPath.length === 0) return;
    
    const newPath = [...currentPath];
    newPath.pop();
    
    if (newPath.length === 0) {
      setCurrentProjects(allProjects);
    } else {
      const parent = newPath[newPath.length - 1];
      const subProjects = parent.children?.filter(child => !child.is_task) ?? [];
      setCurrentProjects(subProjects);
    }
    
    setCurrentPath(newPath);
    setSelectedId(null);
    setExpandedIds(new Set());
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Clicked on root - close opened project and return to all projects
      if (onCloseProject) {
        onCloseProject();
      }
      setCurrentPath([]);
      setCurrentProjects(allProjects);
      setSelectedId(null);
      setExpandedIds(new Set());
      onClose();
      return;
    }

    const newPath = currentPath.slice(0, index + 1);
    const parent = newPath[newPath.length - 1];
    const subProjects = parent.children?.filter(child => !child.is_task) ?? [];
    
    setCurrentPath(newPath);
    setCurrentProjects(subProjects);
    setSelectedId(null);
    setExpandedIds(new Set());
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-card border-2 border-primary/20 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Folder className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Open Project</h2>
                  <p className="text-xs text-muted-foreground">Select a project to focus on</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Compact Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className={cn(
                      'w-48 pl-8 pr-3 py-1.5',
                      'bg-background border border-border rounded-lg',
                      'text-sm text-foreground placeholder:text-muted-foreground',
                      'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20',
                      'transition-all'
                    )}
                  />
                </div>
                
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>
            
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={handleNavigateBack}
                disabled={currentPath.length === 0}
                className={cn(
                  'p-1.5 rounded transition-all',
                  currentPath.length > 0 
                    ? 'hover:bg-secondary text-foreground' 
                    : 'text-muted-foreground/50 cursor-not-allowed'
                )}
                title="Go back"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              
              <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                <button
                  onClick={() => handleBreadcrumbClick(-1)}
                  className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary whitespace-nowrap"
                >
                  All Projects
                </button>
                
                {currentPath.map((project, index) => (
                  <div key={project.id} className="flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className={cn(
                        'px-2 py-1 rounded transition-colors whitespace-nowrap',
                        index === currentPath.length - 1
                          ? 'text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      )}
                    >
                      {project.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Project List */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Folder className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No projects found' : 'No projects available'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredProjects.map(project => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    selectedId={selectedId}
                    expandedIds={expandedIds}
                    onToggleExpand={toggleExpand}
                    onSelect={handleSelect}
                    onNavigateInto={handleNavigateInto}
                    level={0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex justify-between items-center gap-3 flex-shrink-0">
            <p className="text-xs text-muted-foreground">
              {selectedId ? 'Click Open to navigate to the selected project' : 'Select a project to continue'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className={cn(
                  'px-4 py-2 text-sm font-medium',
                  'text-foreground bg-secondary hover:bg-secondary/80',
                  'border border-border rounded-lg transition-all'
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleOpen}
                disabled={selectedId === null}
                className={cn(
                  'px-6 py-2 text-sm font-semibold',
                  'rounded-lg transition-all shadow-sm',
                  selectedId !== null
                    ? 'text-primary-foreground bg-primary hover:bg-primary/90'
                    : 'text-muted-foreground bg-muted cursor-not-allowed'
                )}
              >
                Open
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

interface ProjectItemProps {
  project: Node;
  selectedId: number | null;
  expandedIds: Set<number>;
  onToggleExpand: (nodeId: number) => void;
  onSelect: (nodeId: number) => void;
  onNavigateInto: (project: Node) => void;
  level: number;
}

function ProjectItem({ project, selectedId, expandedIds, onToggleExpand, onSelect, onNavigateInto, level }: ProjectItemProps) {
  const isExpanded = expandedIds.has(project.id);
  const isSelected = selectedId === project.id;
  const subProjects = project.children?.filter(child => !child.is_task) ?? [];
  const hasSubProjects = subProjects.length > 0;

  const handleClick = () => {
    onSelect(project.id);
  };

  const handleDoubleClick = () => {
    if (hasSubProjects) {
      onNavigateInto(project);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all text-left cursor-pointer',
          'hover:bg-secondary/50 group',
          isSelected && 'bg-secondary border-l-2 border-primary'
        )}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {hasSubProjects && (
          <button
            className={cn(
              'flex-shrink-0 w-4 h-4 flex items-center justify-center transition-transform',
              isExpanded && 'rotate-90'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(project.id);
            }}
          >
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
        {!hasSubProjects && <div className="w-4" />}

        {isExpanded && hasSubProjects ? (
          <FolderOpen className="w-4 h-4 text-accent flex-shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:text-accent" />
        )}

        <span className="text-sm text-foreground flex-1 truncate">{project.name}</span>

        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {hasSubProjects ? `${subProjects.length} sub` : ''}
        </span>
      </div>

      {isExpanded && hasSubProjects && (
        <div className="animate-accordion-down">
          {subProjects.map(subProject => (
            <ProjectItem
              key={subProject.id}
              project={subProject}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onNavigateInto={onNavigateInto}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
