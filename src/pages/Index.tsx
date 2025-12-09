import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, PanelLeft, PanelLeftClose, Plus, RefreshCw, Search, ExternalLink, MoreVertical, LogOut, Sun, Moon, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

import { TreeContainer } from '@/components/ProjectTree/TreeContainer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal } from '@/components/ui/dropdown-menu';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SidebarTree } from '@/components/SidebarTree';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ProjectOverviewHeader } from '@/components/ProjectOverviewHeader';
import { SearchBar, type SearchFilters } from '@/components/SearchBar';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '@/hooks/use-keyboard-shortcuts';
import { fetchNodeTree, createNode, updateNode, reorderNodes as reorderNodesApi, moveNode as moveNodeApi, deleteNode, fetchNodeById } from '@/lib/api';
import { buildNodeTree } from '@/lib/nodeTree';
import { cn } from '@/lib/utils';
import type { Node } from '@/types/node';

type SelectionType = { id: number; isTask: boolean };

const loadTree = async () => {
  const { nodes } = await fetchNodeTree();
  return buildNodeTree(nodes);
};

function filterNodes(nodes: Node[], query: string, filters: SearchFilters = {}) {
  const normalizedQuery = query.toLowerCase();

  const visit = (node: Node): Node | null => {
    // Text match
    const textMatches = !query || node.name.toLowerCase().includes(normalizedQuery);
    
    // Status filter
    const statusMatches = !filters.status || node.status === filters.status;
    
    // Deadline filter
    let deadlineMatches = true;
    if (filters.hasDeadline !== undefined) {
      deadlineMatches = filters.hasDeadline ? !!node.deadline : !node.deadline;
    }
    
    const nodeMatches = textMatches && statusMatches && deadlineMatches;
    
    let children: Node[] | undefined;

    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map(visit)
        .filter((child): child is Node => Boolean(child));

      if (nodeMatches) {
        children = node.children;
      } else if (filteredChildren.length > 0) {
        children = filteredChildren;
      }
    }

    if (nodeMatches || children) {
      return {
        ...node,
        children,
      };
    }

    return null;
  };

  return nodes.map(visit).filter((node): node is Node => Boolean(node));
}

const Index = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [isExplorerOpen, setIsExplorerOpen] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('ui:isExplorerOpen');
      if (saved === 'true') return true;
      if (saved === 'false') return false;
    } catch {}
    return false;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('ui:isExplorerOpen', String(isExplorerOpen));
    } catch {}
  }, [isExplorerOpen]);
  const [rootNodes, setRootNodes] = useState<Node[]>([]);
  const [nodeMap, setNodeMap] = useState<Map<number, Node>>(new Map());
  const [selection, setSelection] = useState<SelectionType | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [openedProjectId, setOpenedProjectId] = useState<number | null>(() => {
    try {
      const saved = window.localStorage.getItem('ui:openedProjectId');
      if (saved) return Number(saved) || null;
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingReordersRef = useRef(0);
  const [pendingReorderCount, setPendingReorderCount] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Hover-only menu (no click-to-open)
  const [showAddTaskInput, setShowAddTaskInput] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const addTaskInputRef = useRef<HTMLInputElement>(null);
  const [showAddProjectInput, setShowAddProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const addProjectInputRef = useRef<HTMLInputElement>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuCloseTimerRef = useRef<number | null>(null);
  // Notes editor in main content
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [notesText, setNotesText] = useState('');
  // Meta description modal
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [metaDescription, setMetaDescription] = useState('');
  const metaTextareaRef = useRef<HTMLTextAreaElement>(null);

  const openAddMenu = useCallback(() => {
    if (addMenuCloseTimerRef.current) {
      window.clearTimeout(addMenuCloseTimerRef.current);
      addMenuCloseTimerRef.current = null;
    }
    setIsAddMenuOpen(true);
  }, []);

  const scheduleCloseAddMenu = useCallback(() => {
    if (addMenuCloseTimerRef.current) {
      window.clearTimeout(addMenuCloseTimerRef.current);
    }
    addMenuCloseTimerRef.current = window.setTimeout(() => {
      setIsAddMenuOpen(false);
      addMenuCloseTimerRef.current = null;
    }, 180);
  }, []);

  const refreshTree = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (!force && pendingReordersRef.current > 0) {
      return;
    }
    setLoading(true);
    try {
      const { roots, map } = await loadTree();
      setRootNodes(roots);
      setNodeMap(map);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load nodes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  // If there is a saved opened project, set the active project after nodes load
  useEffect(() => {
    if (openedProjectId != null) {
      setActiveProjectId(openedProjectId);
    }
  }, [openedProjectId]);

  // Sync notes text when target project changes
  useEffect(() => {
    const targetId = openedProjectId ?? activeProjectId;
    if (targetId != null) {
      const node = nodeMap.get(targetId);
      // Legacy notes not used; unify on meta_description
      setNotesText(node?.meta_description || '');
      setMetaDescription(node?.meta_description || '');
    } else {
      setNotesText('');
      setMetaDescription('');
    }
  }, [openedProjectId, activeProjectId, nodeMap]);

  const handleSelect = useCallback(
    (nodeId: number) => {
      const node = nodeMap.get(nodeId);
      if (!node) {
        return;
      }

      setSelection({ id: nodeId, isTask: node.is_task });
      if (node.is_task) {
        setActiveProjectId(node.parent_id ?? null);
      } else {
        setActiveProjectId(nodeId);
      }
    },
    [nodeMap],
  );

  const handleAddProject = useCallback(
    async (parentId?: number, name?: string) => {
      try {
        await createNode({
          name: name || (parentId ? 'New Module' : 'New Project'),
          isTask: false,
          parentId: parentId ?? null,
          status: 'todo',
        });
        toast.success('Project created');
        await refreshTree();
      } catch (err) {
        console.error(err);
        toast.error('Failed to create project', {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [refreshTree],
  );

  const handleAddTask = useCallback(
    async (projectId: number, name?: string) => {
      try {
        const defaultName = name || 'New Task';
        const result = await createNode({
          name: defaultName,
          isTask: true,
          parentId: projectId,
          status: 'todo',
        });
        await refreshTree();
        return result?.node?.id;
      } catch (err) {
        console.error(err);
        toast.error('Failed to create task', {
          description: err instanceof Error ? err.message : undefined,
        });
        return undefined;
      }
    },
    [refreshTree],
  );

  const handleRename = useCallback(
    async (nodeId: number, newName: string) => {
      try {
        await updateNode(nodeId, { name: newName });
        toast.success('Renamed successfully');
        await refreshTree();
      } catch (err) {
        console.error(err);
        toast.error('Failed to rename', {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [refreshTree],
  );

  const handleSetDeadline = useCallback(
    async (nodeId: number, deadline: string | null) => {
      try {
        await updateNode(nodeId, { deadline });
        toast.success(deadline ? 'Deadline updated' : 'Deadline cleared');
      } catch (err) {
        toast.error('Failed to update deadline', {
          description: err instanceof Error ? err.message : undefined,
        });
        return;
      } finally {
        void refreshTree();
      }
    },
    [refreshTree],
  );

  const handleSaveNotes = useCallback(async () => {
    const targetId = openedProjectId ?? activeProjectId;
    if (targetId == null) return;
    try {
      await updateNode(targetId, { metaDescription: notesText });
      toast.success('Notes saved');
    } catch (err) {
      toast.error('Failed to save notes', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      void refreshTree();
    }
  }, [openedProjectId, activeProjectId, notesText, refreshTree]);
  const openMetaModal = useCallback(async () => {
    if (openedProjectId == null) return;
    try {
      const detail = await fetchNodeById(openedProjectId);
      const latest = detail?.data?.metaDescription || '';
      setMetaDescription(latest);
      setIsMetaModalOpen(true);
      setTimeout(() => {
        if (metaTextareaRef.current) {
          metaTextareaRef.current.focus();
          const len = latest.length;
          metaTextareaRef.current.setSelectionRange(len, len);
        }
      }, 10);
    } catch {
      // Fallback to current state
      setIsMetaModalOpen(true);
      setTimeout(() => {
        if (metaTextareaRef.current) {
          const len = metaDescription.length;
          metaTextareaRef.current.focus();
          metaTextareaRef.current.setSelectionRange(len, len);
        }
      }, 10);
    }
  }, [openedProjectId, metaDescription]);

  const handleSaveMeta = useCallback(async () => {
    if (openedProjectId == null) {
      setIsMetaModalOpen(false);
      return;
    }
    try {
      await updateNode(openedProjectId, { metaDescription: metaDescription });
      toast.success('Notes saved');
      setIsMetaModalOpen(false);
    } catch (err) {
      toast.error('Failed to update description', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      void refreshTree();
    }
  }, [openedProjectId, metaDescription, refreshTree]);

  const handleSendToDailyQuest = useCallback(
    async (nodeId: number) => {
      try {
        console.log('[Frontend] Sending task to Daily Quest:', nodeId);
        const response = await fetch(`http://localhost:3000/api/v1/integrations/daily-quest/${nodeId}`, {
          method: 'POST',
          credentials: 'include',
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Failed to send task' }));
          throw new Error(error.message || 'Failed to send task');
        }
        
        const result = await response.json();
        console.log('[Frontend] Daily Quest response:', result);
        toast.success(`Task ${result.message || 'sent to Daily Quest'}`);
      } catch (err) {
        console.error('[Frontend] Failed to send to Daily Quest:', err);
        toast.error('Failed to send to Daily Quest', {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [],
  );

  const handleReorder = useCallback(
    async (parentId: number | null, orderedIds: number[]) => {
      if (orderedIds.length === 0) {
        return;
      }

      pendingReordersRef.current += 1;
      setPendingReorderCount(pendingReordersRef.current);

      try {
        await reorderNodesApi({ parentId: parentId ?? null, orderedIds });
      } catch (err) {
        console.error(err);
        toast.error('Failed to update order', {
          description: err instanceof Error ? err.message : undefined,
        });
        throw err;
      } finally {
        pendingReordersRef.current = Math.max(0, pendingReordersRef.current - 1);
        setPendingReorderCount(pendingReordersRef.current);
        if (pendingReordersRef.current === 0) {
          await refreshTree({ force: true });
        }
      }
    },
    [refreshTree],
  );

  const handleMove = useCallback(
    async (nodeId: number, newParentId: number | null) => {
      try {
        await moveNodeApi({ nodeId, newParentId });
      } catch (err) {
        console.error(err);
        toast.error('Failed to move', {
          description: err instanceof Error ? err.message : undefined,
        });
        throw err;
      } finally {
        void refreshTree();
      }
    },
    [refreshTree],
  );

  const handleDelete = useCallback(
    async (nodeId: number) => {
      // Collect this node and all descendant ids before deleting locally
      const collectIds = (id: number): number[] => {
        const target = nodeMap.get(id);
        if (!target) return [id];
        const ids: number[] = [id];
        const stack = [...(target.children ?? [])];
        while (stack.length > 0) {
          const n = stack.pop()!;
          ids.push(n.id);
          if (n.children && n.children.length) {
            stack.push(...n.children);
          }
        }
        return ids;
      };
      const idsToDeleteInDQ = collectIds(nodeId);
      try {
        await deleteNode(nodeId);
        toast.success('Deleted successfully');
        
        // Clear selection if the deleted node was selected
        if (selection?.id === nodeId) {
          setSelection(null);
        }
        
        // Clear active project if it was the deleted node or descendant
        if (activeProjectId === nodeId) {
          setActiveProjectId(null);
        }
        
        // Clear opened project if it was the deleted node
        if (openedProjectId === nodeId) {
          setOpenedProjectId(null);
        }

        // Daily Quest deletion is now handled server-side; no client calls needed
      } catch (err) {
        toast.error('Failed to delete', {
          description: err instanceof Error ? err.message : undefined,
        });
        throw err;
      } finally {
        void refreshTree();
      }
    },
    [refreshTree, selection, activeProjectId, openedProjectId, nodeMap],
  );

  const handleArchive = useCallback(
    async (nodeId: number, archive: boolean) => {
      try {
        await updateNode(nodeId, { status: archive ? 'archived' : 'todo' });
        toast.success(archive ? 'Archived successfully' : 'Restored successfully');

        if (archive) {
          if (selection?.id === nodeId) {
            setSelection(null);
          }

          if (activeProjectId === nodeId) {
            setActiveProjectId(null);
          }

          if (openedProjectId === nodeId) {
            setOpenedProjectId(null);
          }
        }
      } catch (err) {
        toast.error(archive ? 'Failed to archive' : 'Failed to restore', {
          description: err instanceof Error ? err.message : undefined,
        });
        throw err;
      } finally {
        void refreshTree();
      }
    },
    [refreshTree, selection, activeProjectId, openedProjectId],
  );

  const handleOpenProject = useCallback((nodeId: number) => {
    const node = nodeMap.get(nodeId);
    if (node && !node.is_task) {
      setOpenedProjectId(nodeId);
      setActiveProjectId(nodeId);
      setSelection({ id: nodeId, isTask: false });
      toast.success(`Opened: ${node.name}`);
      try {
        window.localStorage.setItem('ui:openedProjectId', String(nodeId));
      } catch {}
    }
  }, [nodeMap]);

  const handleCloseProject = useCallback(() => {
    setOpenedProjectId(null);
    setSelection(null);
    setActiveProjectId(null);
    toast.info('Closed project workspace');
    try {
      window.localStorage.removeItem('ui:openedProjectId');
    } catch {}
  }, []);

  const handleResetScope = useCallback(() => {
    setSelection(null);
    setActiveProjectId(null);
  }, []);

  const handleCreateTaskClick = useCallback(() => {
    if (openedProjectId != null || activeProjectId != null) {
      setShowAddTaskInput(true);
      setNewTaskName('');
      setTimeout(() => {
        addTaskInputRef.current?.focus();
      }, 50);
    } else {
      toast.info('Open a project first to add tasks.');
    }
  }, [openedProjectId, activeProjectId]);

  const handleSubmitNewTask = useCallback(async () => {
    const taskName = newTaskName.trim();
    if (!taskName) {
      setShowAddTaskInput(false);
      return;
    }

    const projectId = openedProjectId ?? activeProjectId;
    if (projectId) {
      const newTaskId = await handleAddTask(projectId, taskName);
      if (newTaskId) {
        setSelection({ id: newTaskId, isTask: true });
      }
    }
    
    setShowAddTaskInput(false);
    setNewTaskName('');
  }, [newTaskName, openedProjectId, activeProjectId, handleAddTask]);

  const handleTaskInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSubmitNewTask();
    } else if (e.key === 'Escape') {
      setShowAddTaskInput(false);
      setNewTaskName('');
    }
  }, [handleSubmitNewTask]);

  // Keyboard shortcuts
  const shortcuts = [
    {
      key: 'n',
      action: handleCreateTaskClick,
      description: 'Create new task in active project',
    },
    {
      key: 'p',
      shiftKey: true,
      action: () => handleAddProject(),
      description: 'Create new project',
    },
    {
      key: 'Delete',
      action: () => {
        if (selection?.id) {
          void handleDelete(selection.id);
        }
      },
      description: 'Delete selected item',
    },
    {
      key: 'f',
      ctrlKey: true,
      action: () => {
        document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
      },
      description: 'Focus search',
    },
    {
      key: '?',
      shiftKey: true,
      action: () => setShowShortcuts((prev) => !prev),
      description: 'Toggle keyboard shortcuts help',
    },
  ];
  
  useKeyboardShortcuts(shortcuts);

  const filteredNodes = useMemo(() => {
    let baseNodes =
      activeProjectId != null
        ? nodeMap.get(activeProjectId)?.children ?? []
        : rootNodes;

    if (!searchQuery.trim() && Object.keys(searchFilters).length === 0) {
      return baseNodes;
    }

    return filterNodes(baseNodes, searchQuery, searchFilters);
  }, [activeProjectId, nodeMap, rootNodes, searchQuery, searchFilters]);

  const displayNodes = useMemo(() => {
    if (openedProjectId != null) {
      const openedNode = nodeMap.get(openedProjectId);
      // Show only the children of the opened project, not the project itself
      return openedNode?.children ?? [];
    }
    return rootNodes;
  }, [openedProjectId, nodeMap, rootNodes]);

  const selectedProjectName =
    activeProjectId != null
      ? nodeMap.get(activeProjectId)?.name ?? 'Project'
      : 'All Projects';

  const openedProjectName = openedProjectId != null
    ? nodeMap.get(openedProjectId)?.name ?? 'Project'
    : null;

  // Breadcrumb path for the opened project (root -> ... -> current)
  const breadcrumbPath = useMemo(() => {
    if (openedProjectId == null) return [] as Node[];
    const path: Node[] = [];
    let cur: Node | undefined = nodeMap.get(openedProjectId);
    let guard = 0;
    while (cur && guard < 1000) {
      path.push(cur);
      if (cur.parent_id == null) break;
      cur = nodeMap.get(cur.parent_id);
      guard++;
    }
    return path.reverse();
  }, [openedProjectId, nodeMap]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="navbar-container flex-shrink-0 z-50 h-16">
        <div className="h-full px-3 md:px-6 flex items-center justify-between gap-2 md:gap-4">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <button
              onClick={() => setIsExplorerOpen(!isExplorerOpen)}
              className={cn(
                'p-2 text-muted-foreground hover:text-primary',
                'hover:bg-secondary/50 rounded-lg transition-all',
              )}
              title={isExplorerOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {isExplorerOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={handleResetScope}
              className="text-base md:text-lg font-semibold text-primary tracking-tight hover:text-primary/80 transition-colors cursor-pointer whitespace-nowrap"
              title="Go to home page"
            >
              Project Tracker
            </button>
          </div>

          {/* Center/Right: Search + Actions */}
          <div className="flex items-center gap-2 md:gap-3 ml-auto flex-shrink min-w-0">
            {/* Enhanced Search bar - Always visible, responsive width */}
            <div className="flex-shrink min-w-0 w-full sm:w-auto sm:flex-none max-w-[160px] sm:max-w-none">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                filters={searchFilters}
                onFiltersChange={setSearchFilters}
              />
            </div>

            {/* Status Messages */}
            {(loading || pendingReorderCount > 0) && (
              <span className="hidden lg:inline text-xs text-muted-foreground">
                {pendingReorderCount > 0 ? 'Reordering…' : 'Syncing…'}
              </span>
            )}
            {error && <span className="hidden lg:inline text-xs text-destructive">{error}</span>}
            
            {/* Desktop Actions - Hidden on small screens */}
            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={() => void refreshTree()}
                className={cn(
                  'p-1.5 text-muted-foreground hover:text-accent hover:bg-secondary/50',
                  'rounded-md transition-all border border-transparent hover:border-accent/30',
                )}
                title="Refresh"
              >
                <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
              </button>
              <button
                onClick={async () => {
                  try {
                    await fetch('http://localhost:3000/api/v1/auth/logout', {
                      method: 'POST',
                      credentials: 'include',
                    });
                    window.location.href = '/login';
                  } catch (error) {
                    toast.error('Failed to logout');
                  }
                }}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium',
                  'text-orange-600 dark:text-orange-500 hover:text-orange-700 dark:hover:text-orange-400',
                  'bg-orange-500/10 hover:bg-orange-500/20',
                  'rounded-full transition-all',
                  'border border-orange-500/30 hover:border-orange-500/50',
                )}
              >
                Logout
              </button>

              <button
                onClick={() => setShowShortcuts(true)}
                className={cn(
                  'p-1.5 text-muted-foreground hover:text-accent hover:bg-secondary/50',
                  'rounded-md transition-all border border-transparent hover:border-accent/30',
                )}
                title="Keyboard shortcuts (Shift+?)"
              >
                <span className="text-xs font-bold">?</span>
              </button>
            </div>

            {/* Mobile Menu Dropdown - Visible only on small screens */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'p-2 text-muted-foreground hover:text-primary',
                      'hover:bg-secondary/50 rounded-lg transition-all',
                    )}
                    title="Menu"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => void refreshTree()} className="cursor-pointer">
                      <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
                      Refresh
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowShortcuts(true)} className="cursor-pointer">
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Shortcuts
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
                        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                        localStorage.setItem('theme', newTheme);
                        document.documentElement.classList.toggle('dark', newTheme === 'dark');
                      }}
                      className="cursor-pointer"
                    >
                      <Sun className="w-4 h-4 mr-2 dark:hidden" />
                      <Moon className="w-4 h-4 mr-2 hidden dark:block" />
                      <span className="dark:hidden">Dark Mode</span>
                      <span className="hidden dark:inline">Light Mode</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          await fetch('http://localhost:3000/api/v1/auth/logout', {
                            method: 'POST',
                            credentials: 'include',
                          });
                          window.location.href = '/login';
                        } catch (error) {
                          toast.error('Failed to logout');
                        }
                      }}
                      className="cursor-pointer text-orange-600 dark:text-orange-500"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main content with explorer */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Backdrop for mobile when sidebar is open - transparent, just for closing */}
        {isExplorerOpen && (
          <div 
            className="fixed inset-0 top-16 z-30 lg:hidden"
            onClick={() => setIsExplorerOpen(false)}
          />
        )}
        
        {/* Left Explorer Panel - Overlay on mobile, inline on desktop */}
        {isExplorerOpen && (
          <aside className="sidebar-container fixed lg:relative top-16 lg:top-0 left-0 bottom-0 z-40 w-full sm:w-96 lg:w-80 border-r border-border/60 flex flex-col overflow-hidden shadow-2xl lg:shadow-none">
            {/* Project Overview Header in Sidebar */}
            {activeProjectId != null && nodeMap.get(activeProjectId) && (
              <div className="p-4 border-b border-border/60">
                {(() => {
                  // Build unfiltered task list from the active project's full children
                  const collectDescendants = (nodes: Node[] = []): Node[] => {
                    const result: Node[] = [];
                    const stack = [...nodes];
                    while (stack.length) {
                      const n = stack.pop()!;
                      result.push(n);
                      if (n.children && n.children.length) {
                        stack.push(...n.children);
                      }
                    }
                    return result;
                  };
                  const activeProject = nodeMap.get(activeProjectId)!;
                  const allDesc = collectDescendants(activeProject.children ?? []);
                  const allTasksUnfiltered = allDesc.filter(n => n.is_task);
                  return (
                <ProjectOverviewHeader
                  project={nodeMap.get(activeProjectId)!}
                    allTasks={allTasksUnfiltered}
                  onRename={() => {
                    const newName = prompt('Enter new name:', nodeMap.get(activeProjectId)?.name);
                    if (newName) handleRename(activeProjectId, newName);
                  }}
                  onArchive={() => handleArchive(activeProjectId, true)}
                  onDelete={() => handleDelete(activeProjectId)}
                  onNotesChange={(notes) => {
                    void updateNode(activeProjectId, { notes });
                    void refreshTree();
                  }}
                  onEditDescription={() => { void openMetaModal(); }}
                />
                  );
                })()}
              </div>
            )}
            
            {/* Sidebar tree removed per request; sidebar now shows only overview header */}
          </aside>
        )}

        {/* Right Content Panel - Full Height Project/Task View */}
        <main className="main-content flex-1 overflow-hidden flex flex-col relative">
          <div className="flex-1 overflow-y-auto">
            <div className="h-full px-9 py-7">
              {/* Breadcrumb + Actions in main content */}
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-1">
                    {(() => {
                      const segments: { id: number | null; name: string }[] = [];
                      segments.push({ id: null, name: 'All Projects' });
                      if (openedProjectId != null) {
                        if (breadcrumbPath.length > 0) {
                          for (const n of breadcrumbPath) segments.push({ id: n.id, name: n.name });
                        } else if (openedProjectName) {
                          segments.push({ id: openedProjectId, name: openedProjectName });
                        }
                      }
                      return segments.map((seg, idx) => {
                        const isLast = idx === segments.length - 1;
                        const clickable = seg.id === null ? openedProjectId != null : !isLast;
                        return (
                          <span key={seg.id ?? 'root'} className="inline-flex items-center">
                            {idx > 0 && <span className="px-1 text-muted-foreground/50">/</span>}
                            {clickable ? (
                              <button
                                className={cn(
                                  'text-muted-foreground hover:text-primary transition-colors',
                                  isLast ? 'max-w-[300px]' : 'max-w-[150px]',
                                  'truncate'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (seg.id === null) {
                                    handleCloseProject();
                                  } else {
                                    handleOpenProject(seg.id);
                                  }
                                }}
                                title={seg.name}
                              >
                                {seg.name}
                              </button>
                            ) : (
                              <span className={cn(
                                'text-foreground font-medium',
                                isLast ? 'max-w-[300px]' : 'max-w-[150px]',
                                'truncate'
                              )} title={seg.name}>
                                {seg.name}
                              </span>
                            )}
                          </span>
                        );
                      });
                    })()}
                    </div>
                  </div>

                  {/* Notes button inline with breadcrumb */}
                  {openedProjectId != null && (
                    <button
                      onClick={() => { void openMetaModal(); }}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      title="Notes"
                      aria-label="Notes"
                    >
                      {/* document icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <path d="M14 2v6h6"/>
                        <path d="M16 13H8"/>
                        <path d="M16 17H8"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="h-full border-l border-border/40">
                {/* Project/Task Tree - Full Height */}
                <SidebarTree
                  nodes={filteredNodes}
                  allProjects={rootNodes}
                  selectedId={selection?.id ?? null}
                  onSelect={handleSelect}
                  onAddProject={handleAddProject}
                  onAddTask={handleAddTask}
                  onRename={handleRename}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onOpenProject={handleOpenProject}
                  onCloseProject={handleCloseProject}
                  onReorder={handleReorder}
                  onMove={handleMove}
                  onSetDeadline={handleSetDeadline}
                  onSendToDailyQuest={handleSendToDailyQuest}
                  onUpdateNotes={async (nodeId, notes) => {
                    try {
                      await updateNode(nodeId, { metaDescription: notes });
                      toast.success('Notes saved');
                    } catch (err) {
                      toast.error('Failed to save notes', {
                        description: err instanceof Error ? err.message : undefined,
                      });
                    } finally {
                      void refreshTree();
                    }
                  }}
                  onSelectAll={openedProjectId != null ? handleCloseProject : handleResetScope}
                  isAllSelected={activeProjectId == null && openedProjectId == null}
                  openedProjectName={openedProjectName}
                  openedProjectId={openedProjectId}
                  hideBottomButton={true}
                  onStatusChanged={() => { void refreshTree(); }}
                />
              </div>
            </div>
          </div>

          {/* Add Task Button - Full Width at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-border/60 bg-card/50 backdrop-blur-sm overflow-visible">
            <div className="px-9 py-4">
              {/* Notes editor removed from footer per request */}
              {showAddTaskInput ? (
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <input
                    ref={addTaskInputRef}
                    type="text"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    onKeyDown={handleTaskInputKeyDown}
                    onBlur={() => {
                      if (newTaskName.trim()) {
                        void handleSubmitNewTask();
                      } else {
                        setShowAddTaskInput(false);
                      }
                    }}
                    placeholder="Enter task name..."
                    className={cn(
                      'flex-1 text-sm bg-background border border-primary/50 rounded-lg px-4 py-3',
                      'focus:outline-none focus:border-primary transition-colors',
                      'placeholder:text-muted-foreground/50'
                    )}
                  />
                </div>
              ) : (
                <div className="relative flex items-center gap-2">
                  <div
                    className="relative"
                    onMouseEnter={openAddMenu}
                    onMouseLeave={scheduleCloseAddMenu}
                  >
                    <button
                      type="button"
                      aria-label="Add options"
                      className="p-2 rounded-md border border-border/60 hover:border-border bg-card hover:bg-accent/5 text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    {/* Hover dropup controlled via timers; positioned right/up */}
                    {isAddMenuOpen && (
                      <div
                        className="absolute left-full top-0 -translate-y-full ml-2 z-[1000]"
                        onMouseEnter={openAddMenu}
                        onMouseLeave={scheduleCloseAddMenu}
                      >
                        <div className="bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAddProjectInput(true);
                              setIsAddMenuOpen(false);
                              setTimeout(() => addProjectInputRef.current?.focus(), 30);
                            }}
                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent/10 transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            New Module
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {showAddProjectInput ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-muted-foreground" />
                      <input
                        ref={addProjectInputRef}
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const name = newProjectName.trim();
                            if (name) {
                              const parentId = openedProjectId ?? activeProjectId ?? undefined;
                              void handleAddProject(parentId, name);
                            }
                            setShowAddProjectInput(false);
                            setNewProjectName('');
                          } else if (e.key === 'Escape') {
                            setShowAddProjectInput(false);
                            setNewProjectName('');
                          }
                        }}
                        onBlur={() => {
                          const name = newProjectName.trim();
                          if (name) {
                            const parentId = openedProjectId ?? activeProjectId ?? undefined;
                            void handleAddProject(parentId, name);
                          }
                          setShowAddProjectInput(false);
                          setNewProjectName('');
                        }}
                        placeholder="Enter module name..."
                        className={cn(
                          'flex-1 text-sm bg-background border border-primary/50 rounded-lg px-4 py-3',
                          'focus:outline-none focus:border-primary transition-colors',
                          'placeholder:text-muted-foreground/50'
                        )}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={handleCreateTaskClick}
                      className={cn(
                        'flex-1 flex items-center gap-2 px-4 py-3 rounded-lg',
                        'bg-card text-muted-foreground hover:text-foreground',
                        'hover:bg-accent/5 transition-all',
                        'border border-border/60 hover:border-border',
                      )}
                    >
                      <span className="font-medium">New Task</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Meta Description Modal */}
      <Dialog open={isMetaModalOpen} onOpenChange={setIsMetaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notes</DialogTitle>
            <DialogDescription className="sr-only">Add notes or description for this item.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <textarea
              ref={metaTextareaRef}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              className="w-full min-h-[140px] px-3 py-2 rounded-md border border-border/50 bg-background text-sm focus:outline-none focus:ring-0 focus:border-border/40 transition-colors"
              placeholder="Enter notes..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSaveMeta();
                }
              }}
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <DialogClose asChild>
              <button className={cn('px-3 py-1.5 rounded-md bg-secondary text-foreground')}>Cancel</button>
            </DialogClose>
            <button
              onClick={() => { void handleSaveMeta(); }}
              className={cn('px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90')}
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Help Dialog */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-card p-6 rounded-lg shadow-2xl max-w-md w-full mx-4 animate-slideDown"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <KeyboardShortcutsHelp shortcuts={shortcuts} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
