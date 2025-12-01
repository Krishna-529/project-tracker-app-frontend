import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, PanelLeft, PanelLeftClose, Plus, RefreshCw, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { TreeContainer } from '@/components/ProjectTree/TreeContainer';
import { SidebarTree } from '@/components/SidebarTree';
import { ThemeToggle } from '@/components/ThemeToggle';
import { fetchNodeTree, createNode, updateNode, reorderNodes as reorderNodesApi, moveNode as moveNodeApi, deleteNode } from '@/lib/api';
import { buildNodeTree } from '@/lib/nodeTree';
import { cn } from '@/lib/utils';
import type { Node } from '@/types/node';

type SelectionType = { id: number; isTask: boolean };

const loadTree = async () => {
  const { nodes } = await fetchNodeTree();
  return buildNodeTree(nodes);
};

function filterNodes(nodes: Node[], query: string) {
  const normalizedQuery = query.toLowerCase();

  const visit = (node: Node): Node | null => {
    const matches = node.name.toLowerCase().includes(normalizedQuery);
    let children: Node[] | undefined;

    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map(visit)
        .filter((child): child is Node => Boolean(child));

      if (matches) {
        children = node.children;
      } else if (filteredChildren.length > 0) {
        children = filteredChildren;
      }
    }

    if (matches || children) {
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
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [rootNodes, setRootNodes] = useState<Node[]>([]);
  const [nodeMap, setNodeMap] = useState<Map<number, Node>>(new Map());
  const [selection, setSelection] = useState<SelectionType | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [openedProjectId, setOpenedProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingReordersRef = useRef(0);
  const [pendingReorderCount, setPendingReorderCount] = useState(0);

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
          name: name || (parentId ? 'New Subproject' : 'New Project'),
          isTask: false,
          parentId: parentId ?? null,
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
        await createNode({
          name: name || 'New Task',
          isTask: true,
          parentId: projectId,
          status: 'todo',
        });
        toast.success('Task created');
        await refreshTree();
      } catch (err) {
        console.error(err);
        toast.error('Failed to create task', {
          description: err instanceof Error ? err.message : undefined,
        });
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
      } catch (err) {
        toast.error('Failed to delete', {
          description: err instanceof Error ? err.message : undefined,
        });
        throw err;
      } finally {
        void refreshTree();
      }
    },
    [refreshTree, selection, activeProjectId, openedProjectId],
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
    }
  }, [nodeMap]);

  const handleCloseProject = useCallback(() => {
    setOpenedProjectId(null);
    setSelection(null);
    setActiveProjectId(null);
    toast.info('Closed project workspace');
  }, []);

  const handleResetScope = useCallback(() => {
    setSelection(null);
    setActiveProjectId(null);
  }, []);

  const handleCreateTaskClick = useCallback(() => {
    if (activeProjectId != null) {
      void handleAddTask(activeProjectId);
    } else {
      toast.info('Select a project in the explorer first.');
    }
  }, [activeProjectId, handleAddTask]);

  const filteredNodes = useMemo(() => {
    const baseNodes =
      activeProjectId != null
        ? nodeMap.get(activeProjectId)?.children ?? []
        : rootNodes;

    if (!searchQuery.trim()) {
      return baseNodes;
    }

    return filterNodes(baseNodes, searchQuery);
  }, [activeProjectId, nodeMap, rootNodes, searchQuery]);

  const displayNodes = useMemo(() => {
    if (openedProjectId != null) {
      const openedNode = nodeMap.get(openedProjectId);
      return openedNode ? [openedNode] : [];
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

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsExplorerOpen(!isExplorerOpen)}
              className={cn(
                'p-2 text-muted-foreground hover:text-primary',
                'hover:bg-secondary/50 border border-transparent hover:border-border',
                'rounded-lg transition-all focus-ring',
              )}
              title={isExplorerOpen ? 'Close explorer' : 'Open explorer'}
            >
              {isExplorerOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeft className="w-5 h-5" />
              )}
            </button>

            <h1 className="text-xl font-bold text-foreground">Project Tracker</h1>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search projects and tasks..."
                className={cn(
                  'pl-10 pr-4 py-2 w-80',
                  'bg-background border-2 border-border rounded-lg',
                  'text-sm text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
                  'transition-all hover:border-accent/50',
                )}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {(loading || pendingReorderCount > 0) && (
              <span className="text-xs text-muted-foreground">
                {pendingReorderCount > 0 ? 'Reordering…' : 'Syncing…'}
              </span>
            )}
            {error && <span className="text-xs text-destructive">{error}</span>}
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
              onClick={handleResetScope}
              className={cn(
                'px-3 py-1.5 text-sm font-medium',
                'text-muted-foreground hover:text-primary hover:bg-secondary/50',
                'rounded-md transition-all scale-press border border-transparent hover:border-primary/30',
              )}
            >
              All Projects
            </button>

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
              Views
            </button>

            <button
              onClick={handleCreateTaskClick}
              className={cn(
                'px-3 py-1.5 text-sm font-medium',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'rounded-md transition-colors scale-press',
                'flex items-center gap-2',
              )}
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          </div>
        </div>
      </header>

      {/* Main content with explorer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Explorer Panel */}
        {isExplorerOpen && (
          <aside className="w-72 bg-card border-r border-border flex flex-col overflow-hidden">
            <SidebarTree
              nodes={displayNodes}
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
              onSelectAll={openedProjectId != null ? handleCloseProject : handleResetScope}
              isAllSelected={activeProjectId == null && openedProjectId == null}
              openedProjectName={openedProjectName}
            />
          </aside>
        )}

        {/* Right Content Panel */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-5xl mx-auto">
              {/* Breadcrumb */}
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-foreground">{selectedProjectName}</h2>
              </div>

              {/* Tree view */}
              <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
                <TreeContainer nodes={filteredNodes} />
              </div>

              {/* Empty state */}
              {filteredNodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-6 border-2 border-primary/30 shadow-sm">
                    <LayoutGrid className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">No items yet</h2>
                  <p className="text-muted-foreground mb-8 max-w-md text-base">
                    Start organizing your work by creating your first project or task.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateTaskClick}
                      className={cn(
                        'px-6 py-3 text-sm font-semibold',
                        'text-primary-foreground bg-primary hover:bg-primary/90',
                        'rounded-lg transition-all btn-lift focus-ring',
                        'flex items-center gap-2 shadow-md',
                      )}
                    >
                      <Plus className="w-5 h-5" />
                      Create Task
                    </button>
                    <button
                      onClick={() => handleAddProject()}
                      className={cn(
                        'px-6 py-3 text-sm font-semibold',
                        'text-primary bg-secondary hover:bg-secondary/80',
                        'border-2 border-primary/20 hover:border-primary',
                        'rounded-lg transition-all btn-lift focus-ring',
                        'flex items-center gap-2 shadow-sm',
                      )}
                    >
                      <Plus className="w-5 h-5" />
                      Create Project
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
