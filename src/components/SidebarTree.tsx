import {
  DndContext,
  DragOverlay,
  MouseSensor,
  type DragEndEvent,
  type DragStartEvent,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Archive, ArchiveRestore, ChevronRight, ChevronsDownUp, ChevronsUpDown, Folder, FolderOpen, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { Node } from '@/types/node';
import { ProjectPickerModal } from './ProjectPickerModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SidebarTreeProps {
  nodes: Node[];
  allProjects?: Node[];
  selectedId: number | null;
  onSelect: (nodeId: number) => void;
  onAddProject: (parentId?: number, name?: string) => void;
  onAddTask: (projectId: number, name?: string) => void;
  onRename?: (nodeId: number, newName: string) => void;
  onArchive?: (nodeId: number, archive: boolean) => void | Promise<unknown>;
  onDelete?: (nodeId: number) => void | Promise<unknown>;
  onOpenProject?: (nodeId: number) => void;
  onCloseProject?: () => void;
  onReorder?: (parentId: number | null, orderedIds: number[]) => void | Promise<unknown>;
  onMove?: (nodeId: number, newParentId: number | null) => void | Promise<unknown>;
  onSelectAll?: () => void;
  isAllSelected?: boolean;
  openedProjectName?: string | null;
}

export function SidebarTree({
  nodes,
  allProjects = [],
  selectedId,
  onSelect,
  onAddProject,
  onAddTask,
  onRename,
  onArchive,
  onDelete,
  onOpenProject,
  onCloseProject,
  onReorder,
  onMove,
  onSelectAll,
  isAllSelected,
  openedProjectName,
}: SidebarTreeProps) {
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showBottomAddInput, setShowBottomAddInput] = useState(false);
  const [bottomProjectName, setBottomProjectName] = useState('');
  const bottomInputRef = useRef<HTMLInputElement>(null);
  const [treeData, setTreeData] = useState<Node[]>(nodes);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  const [overNodeId, setOverNodeId] = useState<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const latestNodesRef = useRef(nodes);
  const isSyncingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use mouse sensor with distance - requires moving 8px before drag starts
  // This allows clicks to work normally while still enabling drag
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });
  const sensors = useSensors(mouseSensor);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  useEffect(() => {
    console.log('[SidebarTree] nodes prop changed, isSyncingRef:', isSyncingRef.current);
    console.log('[SidebarTree] New nodes structure:', JSON.stringify(nodes.map(n => ({ id: n.id, name: n.name, children: n.children?.map(c => ({ id: c.id, name: c.name })) })), null, 2));
    
    latestNodesRef.current = nodes;
    if (!isSyncingRef.current) {
      console.log('[SidebarTree] Updating treeData with new nodes');
      setTreeData(nodes);
    } else {
      console.log('[SidebarTree] Skipping treeData update because syncing');
    }
  }, [nodes]);
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (showBottomAddInput && bottomInputRef.current) {
      bottomInputRef.current.focus();
    }
  }, [showBottomAddInput]);

  useEffect(() => {
    if (activeDragId) {
      console.log('[State] isShiftPressed changed to:', isShiftPressed);
    }
  }, [isShiftPressed, activeDragId]);

  const handleCreateBottomProject = () => {
    const trimmedName = bottomProjectName.trim();
    if (!trimmedName) return;

    onAddProject(undefined, trimmedName);
    setBottomProjectName('');
    setShowBottomAddInput(false);
  };

  const handleBottomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateBottomProject();
    } else if (e.key === 'Escape') {
      setBottomProjectName('');
      setShowBottomAddInput(false);
    }
  };

  const handleOpenProjectFromModal = (nodeId: number) => {
    onOpenProject?.(nodeId);
  };

  const activeDragNode = useMemo(() => {
    if (activeDragId == null) {
      return null;
    }
    return findNodeById(treeData, activeDragId);
  }, [activeDragId, treeData]);

  // Custom collision detection that prefers dropping onto projects (for reparenting)
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First check pointer within (more precise for drop targets)
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    // Fall back to rect intersection
    return rectIntersection(args);
  }, []);

  const handleDragOver = useCallback((event: any) => {
    if (event.over) {
      setHoveredNodeId(Number(event.over.id));
      setOverNodeId(Number(event.over.id));
    } else {
      setHoveredNodeId(null);
      setOverNodeId(null);
    }
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(Number(event.active.id));
    console.log('[DragStart] Started dragging node:', event.active.id);
    
    // Check initial Shift state
    const initialShiftState = event.active.data.current?.event?.shiftKey || false;
    if (initialShiftState) {
      setIsShiftPressed(true);
      console.log('[DragStart] Shift initially pressed');
    }
    
    // Track Shift key state
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        console.log('[Shift] Key pressed down');
        setIsShiftPressed(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        console.log('[Shift] Key released');
        setIsShiftPressed(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Cleanup on drag end
    const cleanup = () => {
      console.log('[DragStart] Cleaning up event listeners');
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mouseup', cleanup);
    };
    
    window.addEventListener('mouseup', cleanup, { once: true });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const wasShiftPressed = isShiftPressed;
    console.log('[DragEnd] wasShiftPressed:', wasShiftPressed);
    console.log('[DragEnd] activeId:', event.active.id, 'overId:', event.over?.id);
    
    setActiveDragId(null);
    setIsShiftPressed(false);
    setHoveredNodeId(null);
    
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeId = Number(active.id);
    const overId = Number(over.id);

    if (activeId === overId) {
      return;
    }

    // Check if Shift was pressed - this takes priority over parent checking
    if (wasShiftPressed) {
      console.log('[DragEnd] Shift mode - attempting to move into folder');
      // Shift mode: move into folder
      const overNode = findNodeById(treeData, overId);
      const activeNode = findNodeById(treeData, activeId);
      
      console.log('[DragEnd] Active node:', activeNode?.name, '(id:', activeId, ', parent_id:', activeNode?.parent_id, ')');
      console.log('[DragEnd] Over node:', overNode?.name, '(id:', overId, ', parent_id:', overNode?.parent_id, ', is_task:', overNode?.is_task, ')');
      console.log('[DragEnd] Active node children:', activeNode?.children?.map(c => `${c.name}(${c.id})`));
      console.log('[DragEnd] Tree structure:', JSON.stringify(treeData, null, 2));
      
      if (!overNode) {
        console.log('[DragEnd] Over node not found, aborting');
        return;
      }
      
      if (overNode.is_task) {
        console.log('[DragEnd] Cannot drop into a task, aborting');
        return;
      }
      
      // Don't allow dropping a node onto its own descendant
      const activeNodeFromTree = findNodeById(treeData, activeId);
      const isTargetDescendant = activeNodeFromTree ? isDescendant([activeNodeFromTree], activeNodeFromTree.id, overId) : false;
      
      if (isTargetDescendant) {
        console.log('[DragEnd] Cannot drop node onto its own descendant, aborting');
        return;
      }
      
      // Check if active node is already a child of over node
      if (activeNode?.parent_id === overId) {
        console.log('[DragEnd] Node is already a child of target, aborting');
        return;
      }
      
      if (onMove) {
        console.log('[DragEnd] Calling onMove with activeId:', activeId, 'newParentId:', overId);
        const updatedTree = moveNodeWithinTree(treeData, activeId, overId);
        setTreeData(updatedTree);
        isSyncingRef.current = true;
        const maybePromise = onMove(activeId, overId);
        if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
          void (maybePromise as Promise<unknown>)
            .then(() => {
              isSyncingRef.current = false;
            })
            .catch((error) => {
              console.error('[DragEnd] Move operation failed:', error);
              isSyncingRef.current = false;
              setTreeData(latestNodesRef.current);
            });
        } else {
          isSyncingRef.current = false;
        }
      }
      return; // Exit early when Shift was pressed
    }

    // Normal mode: reorder within same parent
    const activeParentId = (active.data.current?.parentId ?? null) as number | null;
    const overParentId = (over.data.current?.parentId ?? null) as number | null;

    if (activeParentId === overParentId) {
      console.log('[DragEnd] Reordering within same parent:', activeParentId);
      console.log('[DragEnd] Before reorder, treeData:', JSON.stringify(treeData.map(n => ({ id: n.id, name: n.name, children: n.children?.map(c => ({ id: c.id, name: c.name })) })), null, 2));
      
      const updatedTree = reorderWithinParent(treeData, activeParentId, activeId, overId);
      if (updatedTree === treeData) {
        return;
      }

      console.log('[DragEnd] After reorder, updatedTree:', JSON.stringify(updatedTree.map(n => ({ id: n.id, name: n.name, children: n.children?.map(c => ({ id: c.id, name: c.name })) })), null, 2));

      // Optimistic update
      setTreeData(updatedTree);

      // Debounce API call to prevent race conditions
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const orderedIds = getChildOrder(updatedTree, activeParentId);
        console.log('[DragEnd] Sending reorder to backend - parentId:', activeParentId, 'orderedIds:', orderedIds);
        if (orderedIds.length > 0 && onReorder) {
          isSyncingRef.current = true;
          const maybePromise = onReorder(activeParentId, orderedIds);
          if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
            void (maybePromise as Promise<unknown>)
              .then(() => {
                isSyncingRef.current = false;
              })
              .catch(() => {
                isSyncingRef.current = false;
                console.error("Failed to save reorder");
              });
          } else {
            isSyncingRef.current = false;
          }
        }
      }, 600); // 600ms debounce
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setIsShiftPressed(false);
    setHoveredNodeId(null);
    setOverNodeId(null);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const expandAll = () => {
    const rootLevelIds = new Set<number>();
    // Only expand root level nodes (direct children), not grandchildren
    treeData.forEach(node => {
      if (!node.is_task) {
        rootLevelIds.add(node.id);
      }
    });
    setExpandedNodes(rootLevelIds);
  };

  const toggleNodeExpansion = (nodeId: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  return (
    <>
      <div className="h-full flex flex-col bg-card">
        {/* Header with Open Project Button */}
        <div className="px-4 py-3 border-b border-border bg-secondary/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2
              className={cn(
                'text-sm font-bold text-primary tracking-wide uppercase truncate flex-1',
                onSelectAll && 'cursor-pointer',
                isAllSelected ? 'text-primary' : 'text-primary/80',
              )}
              onClick={onSelectAll}
            >
              {openedProjectName || 'All Projects'}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={expandedNodes.size > 0 ? collapseAll : expandAll}
                className={cn(
                  'p-1.5 rounded-md transition-all flex-shrink-0',
                  'hover:bg-primary/20 border border-transparent hover:border-primary/30',
                  'text-muted-foreground hover:text-primary'
                )}
                title={expandedNodes.size > 0 ? "Collapse All" : "Expand All"}
              >
                {expandedNodes.size > 0 ? (
                  <ChevronsDownUp className="w-4 h-4" />
                ) : (
                  <ChevronsUpDown className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setShowProjectPicker(true)}
                className={cn(
                  'p-1.5 rounded-md transition-all flex-shrink-0',
                  'hover:bg-primary/20 border border-transparent hover:border-primary/30',
                  'text-muted-foreground hover:text-primary'
                )}
                title="Open Project"
              >
                <Folder className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 overflow-y-auto flex-1" onWheel={handleWheel}>
          {/* Shift key indicator during drag */}
          {activeDragId && (
            <div className={cn(
              "fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg transition-all",
              isShiftPressed 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground"
            )}>
              <span className="text-sm font-medium">
                {isShiftPressed ? "🎯 Drop into folder mode" : "↕️ Reorder mode (Hold Shift to move into folder)"}
              </span>
            </div>
          )}
          
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={treeData.map(node => node.id)} strategy={verticalListSortingStrategy}>
              {treeData.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  parentId={null}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onAddProject={onAddProject}
                  onAddTask={onAddTask}
                  onRename={onRename}
                  onDelete={onDelete}
                  onArchive={onArchive}
                  level={0}
                  isShiftPressed={isShiftPressed}
                  hoveredNodeId={hoveredNodeId}
                  activeDragId={activeDragId}
                  overNodeId={overNodeId}
                  isExpanded={expandedNodes.has(node.id)}
                  onToggleExpand={() => toggleNodeExpansion(node.id)}
                  expandedNodes={expandedNodes}
                  toggleNodeExpansion={toggleNodeExpansion}
                />
              ))}
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {activeDragNode ? <DragPreview node={activeDragNode} /> : null}
            </DragOverlay>
          </DndContext>
        </div>
        
        {/* Floating Add Project Button - Only show at root level */}
        {!openedProjectName && (
          <div className="px-3 pb-3 flex-shrink-0 border-t border-border bg-card">
            {showBottomAddInput ? (
              <div className="flex items-center gap-2 mt-3">
                <input
                  ref={bottomInputRef}
                  type="text"
                  value={bottomProjectName}
                  onChange={(e) => setBottomProjectName(e.target.value)}
                  onBlur={() => {
                    if (!bottomProjectName.trim()) {
                      setShowBottomAddInput(false);
                    }
                  }}
                  onKeyDown={handleBottomKeyDown}
                  placeholder="Project name..."
                  className="flex-1 text-sm bg-background border-2 border-accent rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <button
                  onClick={handleCreateBottomProject}
                  disabled={!bottomProjectName.trim()}
                  className={cn(
                    'px-3 py-2 text-xs font-medium rounded-lg transition-all',
                    bottomProjectName.trim()
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowBottomAddInput(true)}
                className={cn(
                  'w-full mt-3 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg transition-all',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'border border-primary/20 hover:border-primary/30',
                  'shadow-sm hover:shadow-md'
                )}
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">New Project</span>
              </button>
            )}
          </div>
        )}
      </div>

      <ProjectPickerModal
        isOpen={showProjectPicker}
        onClose={() => setShowProjectPicker(false)}
        allProjects={allProjects}
        onSelectProject={handleOpenProjectFromModal}
        onCloseProject={onCloseProject}
      />
    </>
  );
}

interface TreeNodeProps {
  node: Node;
  parentId: number | null;
  selectedId: number | null;
  onSelect: (nodeId: number) => void;
  onAddProject: (parentId?: number, name?: string) => void;
  onAddTask: (projectId: number, name?: string) => void;
  onRename?: (nodeId: number, newName: string) => void;
  onArchive?: (nodeId: number, archive: boolean) => void | Promise<unknown>;
  onDelete?: (nodeId: number) => void | Promise<unknown>;
  level: number;
  isShiftPressed: boolean;
  hoveredNodeId: number | null;
  activeDragId: number | null;
  overNodeId: number | null;
  isDraggingAncestor?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  expandedNodes: Set<number>;
  toggleNodeExpansion: (nodeId: number) => void;
}

function TreeNode({ node, parentId, selectedId, onSelect, onAddProject, onAddTask, onRename, onArchive, onDelete, level, isShiftPressed, hoveredNodeId, activeDragId, overNodeId, isDraggingAncestor, isExpanded, onToggleExpand, expandedNodes, toggleNodeExpansion }: TreeNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [showAddInput, setShowAddInput] = useState(false);
  const [addInputType, setAddInputType] = useState<'project' | 'task'>('project');
  const [addName, setAddName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const childNodes = node.children ?? [];
  const canExpand = !node.is_task;
  const isSelected = selectedId === node.id;
  const isArchived = node.status === 'archived';

  const { activeChildNodes, archivedChildNodes } = useMemo(() => {
    const active: Node[] = [];
    const archived: Node[] = [];

    childNodes.forEach(child => {
      if (child.status === 'archived') {
        archived.push(child);
      } else {
        active.push(child);
      }
    });

    return {
      activeChildNodes: active,
      archivedChildNodes: archived,
    };
  }, [childNodes]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    data: { parentId },
    disabled: isDraggingAncestor ?? false,
  });

  useEffect(() => {
    setEditName(node.name);
  }, [node.name]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (showAddInput && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [showAddInput]);

  useEffect(() => {
    if (isArchived && showAddInput) {
      setShowAddInput(false);
    }
  }, [isArchived, showAddInput]);

  const handleRename = () => {
    if (editName.trim() && editName !== node.name && onRename) {
      onRename(node.id, editName.trim());
    } else {
      setEditName(node.name);
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditName(node.name);
      setIsRenaming(false);
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateAdd();
    } else if (e.key === 'Escape') {
      setAddName('');
      setShowAddInput(false);
    }
  };

  const handleCreateAdd = () => {
    const trimmedName = addName.trim();
    if (!trimmedName || isArchived) return;

    if (addInputType === 'project') {
      onAddProject(node.id, trimmedName);
    } else if (onAddTask) {
      onAddTask(node.id, trimmedName);
    }

    setAddName('');
    setShowAddInput(false);
  };

  const handleStartAdd = (type: 'project' | 'task') => {
    if (node.is_task || isArchived) {
      return;
    }
    setAddInputType(type);
    setAddName('');
    setShowAddInput(true);
    if (!isExpanded) {
      onToggleExpand();
    }
  };

  const handleClick = () => {
    onSelect(node.id);
    if (canExpand) {
      onToggleExpand();
    }
  };



  // Remove transforms during drag - elements stay in place, only show drop indicator
  const wrapperStyle: CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  const rowStyle: CSSProperties = {
    paddingLeft: `${level * 20 + 8}px`,
  };

  const statusIndicator = node.is_task
    ? cn(
        'w-1.5 h-1.5 rounded-full flex-shrink-0',
        node.status === 'done'
          ? 'bg-success'
          : node.status === 'in_progress'
            ? 'bg-warning'
            : 'bg-muted-foreground/30',
      )
    : undefined;

  const folderIconClass = isArchived
    ? 'text-muted-foreground/60'
    : isSelected
      ? 'text-accent'
      : 'text-muted-foreground';

  const nameClasses = cn(
    'text-sm truncate flex-1 text-foreground',
    node.is_task && node.status === 'done' && 'text-muted-foreground line-through',
    isArchived && 'text-muted-foreground/80 italic',
  );

  const archivedChildCount = archivedChildNodes.length;
  const hasArchivedChildren = archivedChildCount > 0;

  const menuSections: { key: string; content: ReactNode }[] = [];

  if (!node.is_task && !isArchived) {
    menuSections.push({
      key: 'add',
      content: (
        <>
          <button
            className="w-full px-3 py-1.5 text-xs text-left text-foreground hover:bg-secondary hover:text-primary transition-all font-medium flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              handleStartAdd('project');
            }}
          >
            <Plus className="w-3 h-3" />
            Add Project
          </button>
          {onAddTask && (
            <>
              <div className="h-px bg-border my-0.5" />
              <button
                className="w-full px-3 py-1.5 text-xs text-left text-foreground hover:bg-secondary hover:text-primary transition-all font-medium flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartAdd('task');
                }}
              >
                <Plus className="w-3 h-3" />
                Add Task
              </button>
            </>
          )}
        </>
      ),
    });
  }

  if (onRename) {
    menuSections.push({
      key: 'rename',
      content: (
        <button
          className="w-full px-3 py-1.5 text-xs text-left text-foreground hover:bg-secondary hover:text-primary transition-all font-medium flex items-center gap-2"
          onClick={(e) => {
            e.stopPropagation();
            setIsRenaming(true);
          }}
        >
          <Pencil className="w-3 h-3" />
          Rename
        </button>
      ),
    });
  }

  if (onArchive) {
    menuSections.push({
      key: 'archive',
      content: (
        <button
          className="w-full px-3 py-1.5 text-xs text-left text-foreground hover:bg-secondary hover:text-primary transition-all font-medium flex items-center gap-2"
          onClick={(e) => {
            e.stopPropagation();
            onArchive(node.id, !isArchived);
          }}
        >
          {isArchived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
          {isArchived ? 'Restore' : 'Archive'}
        </button>
      ),
    });
  }

  if (onDelete) {
    menuSections.push({
      key: 'delete',
      content: (
        <button
          className="w-full px-3 py-1.5 text-xs text-left text-destructive hover:bg-destructive/10 transition-all font-medium flex items-center gap-2"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteConfirm(true);
          }}
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      ),
    });
  }

  // Check if this node is a valid drop target when Shift is pressed
  // Only show highlight if: not a task, Shift pressed, being hovered, not dragging self, and not already the parent
  const isAlreadyParent = node.children?.some(child => child.id === activeDragId) || false;
  const isShiftDropTarget = !node.is_task && isShiftPressed && hoveredNodeId === node.id && activeDragId !== null && activeDragId !== node.id && !isAlreadyParent;
  
  // Show drop indicator line when hovering over this node (not in Shift mode)
  const showDropIndicator = !isShiftPressed && overNodeId === node.id && activeDragId !== null && activeDragId !== node.id;

  return (
    <div ref={setNodeRef} className="relative" style={wrapperStyle} {...attributes}>
        {/* Drop indicator line - shows where item will be dropped */}
        {showDropIndicator && (
          <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary z-20 pointer-events-none" 
               style={{ left: `${level * 20}px` }} />
        )}

        {level > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 w-px bg-border"
            style={{ left: `${(level - 1) * 20 + 10}px` }}
          />
        )}

        {/* Visual feedback for Shift+drag drop target */}
        {isShiftDropTarget && (
          <div className="absolute inset-0 rounded-lg ring-2 ring-primary ring-inset pointer-events-none z-10 bg-primary/5" />
        )}

        <div
          {...listeners}
        className={cn(
          'group flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-all select-none',
          'hover:bg-secondary/50',
          isSelected
            ? 'bg-secondary border-l-3 border-accent font-medium shadow-sm'
            : 'border-l-3 border-transparent hover-border-accent/30',
          isDragging && 'cursor-grabbing',
          isShiftDropTarget && 'ring-2 ring-primary',
          isArchived && !isSelected && 'opacity-70',
        )}
        style={rowStyle}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {canExpand ? (
          <div
            className={cn(
              'flex-shrink-0 w-4 h-4 flex items-center justify-center transition-transform text-muted-foreground',
              isExpanded && 'rotate-90',
            )}
          >
            <ChevronRight className="w-3 h-3" />
          </div>
        ) : (
          <div className="w-4" />
        )}

        {node.is_task ? (
          <div className="w-4 h-4 flex items-center justify-center">
            <span className={statusIndicator} />
          </div>
        ) : isExpanded ? (
          <FolderOpen className={cn('w-4 h-4 flex-shrink-0', folderIconClass)} />
        ) : (
          <Folder className={cn('w-4 h-4 flex-shrink-0', folderIconClass)} />
        )}

        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm bg-background border border-accent rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-accent/20"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className={nameClasses}>{node.name}</span>
            {isArchived && (
              <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                Archived
              </span>
            )}
          </div>
        )}

        {isHovered && !isRenaming && (
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <div className="relative group/menu">
              <div
                className="w-6 h-6 flex items-center justify-center hover:bg-accent/20 rounded-md border border-transparent hover:border-accent/50 transition-all cursor-pointer"
                title="More actions"
              >
                <MoreVertical className="w-3.5 h-3.5 text-muted-foreground hover:text-accent" />
              </div>

              <div
                className="absolute right-0 top-full mt-1 min-w-[150px] bg-card border-2 border-primary/20 rounded-lg shadow-xl py-1 z-50 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                {menuSections.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No actions available</div>
                ) : (
                  menuSections.map((section, index) => (
                    <Fragment key={section.key}>
                      {index > 0 && <div className="h-px bg-border my-0.5" />}
                      {section.content}
                    </Fragment>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {node.is_task ? 'Task' : 'Project'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{node.name}"?
              {!node.is_task && (node.children?.length ?? 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This will also delete all {node.children?.length} child item{node.children?.length !== 1 ? 's' : ''}.
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (onDelete) {
                  onDelete(node.id);
                }
                setShowDeleteConfirm(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!node.is_task && isExpanded && (
        <>
          {archivedChildNodes.length > 0 && (
            <>
              <div className="relative">
                {level >= 0 && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-px bg-border"
                    style={{ left: `${level * 20 + 10}px` }}
                  />
                )}
                <div
                  className={cn(
                    'group flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-all',
                    'hover:bg-secondary/50',
                  )}
                  style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}
                  onClick={() => setIsArchivedExpanded(prev => !prev)}
                >
                  <div
                    className={cn(
                      'flex-shrink-0 w-4 h-4 flex items-center justify-center transition-transform text-muted-foreground',
                      isArchivedExpanded && 'rotate-90',
                    )}
                  >
                    <ChevronRight className="w-3 h-3" />
                  </div>
                  <Archive className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Archived</span>
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full ml-1">{archivedChildCount}</span>
                </div>
              </div>
              {isArchivedExpanded && (
                <SortableContext items={archivedChildNodes.map(child => child.id)} strategy={verticalListSortingStrategy}>
                  {archivedChildNodes.map(child => (
                    <TreeNode
                      key={`archived-${child.id}`}
                      node={child}
                      parentId={node.id}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      onAddProject={onAddProject}
                      onAddTask={onAddTask}
                      onRename={onRename}
                      onArchive={onArchive}
                      onDelete={onDelete}
                      level={level + 1}
                      isShiftPressed={isShiftPressed}
                      hoveredNodeId={hoveredNodeId}
                      activeDragId={activeDragId}
                      overNodeId={overNodeId}
                      isDraggingAncestor={isDragging || isDraggingAncestor}
                      isExpanded={expandedNodes.has(child.id)}
                      onToggleExpand={() => toggleNodeExpansion(child.id)}
                      expandedNodes={expandedNodes}
                      toggleNodeExpansion={toggleNodeExpansion}
                    />
                  ))}
                </SortableContext>
              )}
            </>
          )}

          {isDragging ? (
            // When this node is being dragged, children stay in place with reduced opacity
            activeChildNodes.map(child => (
              <TreeNode
                key={child.id}
                node={child}
                parentId={node.id}
                selectedId={selectedId}
                onSelect={onSelect}
                onAddProject={onAddProject}
                onAddTask={onAddTask}
                onRename={onRename}
                onArchive={onArchive}
                onDelete={onDelete}
                level={level + 1}
                isShiftPressed={isShiftPressed}
                hoveredNodeId={hoveredNodeId}
                activeDragId={activeDragId}
                overNodeId={overNodeId}
                isDraggingAncestor={true}
                isExpanded={expandedNodes.has(child.id)}
                onToggleExpand={() => toggleNodeExpansion(child.id)}
                expandedNodes={expandedNodes}
                toggleNodeExpansion={toggleNodeExpansion}
              />
            ))
          ) : (
            <SortableContext items={activeChildNodes.map(child => child.id)} strategy={verticalListSortingStrategy}>
              {activeChildNodes.map(child => (
                <TreeNode
                  key={child.id}
                  node={child}
                  parentId={node.id}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onAddProject={onAddProject}
                  onAddTask={onAddTask}
                  onRename={onRename}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  level={level + 1}
                  isShiftPressed={isShiftPressed}
                  hoveredNodeId={hoveredNodeId}
                  activeDragId={activeDragId}
                  overNodeId={overNodeId}
                  isDraggingAncestor={false}
                  isExpanded={expandedNodes.has(child.id)}
                  onToggleExpand={() => toggleNodeExpansion(child.id)}
                  expandedNodes={expandedNodes}
                  toggleNodeExpansion={toggleNodeExpansion}
                />
              ))}
            </SortableContext>
          )}

          {!isArchived && showAddInput && (
            <div className="relative" style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}>
              {level >= 0 && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-px bg-border"
                  style={{ left: `${level * 20 + 10}px` }}
                />
              )}
              <div className="flex items-center gap-2 py-2 px-2">
                <input
                  ref={addInputRef}
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onBlur={() => {
                    if (!addName.trim()) {
                      setShowAddInput(false);
                    }
                  }}
                  onKeyDown={handleAddKeyDown}
                  placeholder={`${addInputType === 'project' ? 'Project' : 'Task'} name...`}
                  className="flex-1 text-sm bg-background border-2 border-accent rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/20"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateAdd();
                  }}
                  disabled={!addName.trim()}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                    addName.trim()
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const DragPreview = ({ node }: { node: Node }) => (
  <div className="px-3 py-2 bg-card border border-border rounded-lg shadow-xl">
    <span className="text-sm font-medium text-foreground">{node.name}</span>
  </div>
);

const findNodeById = (nodes: Node[], id: number): Node | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

const reorderWithinParent = (
  nodes: Node[],
  parentId: number | null,
  activeId: number,
  overId: number,
): Node[] => {
  if (parentId === null) {
    const activeIndex = nodes.findIndex(node => node.id === activeId);
    const overIndex = nodes.findIndex(node => node.id === overId);

    if (activeIndex === -1 || overIndex === -1) {
      return nodes;
    }

    return arrayMove(nodes, activeIndex, overIndex);
  }

  let changed = false;

  const nextNodes = nodes.map(node => {
    if (!node.children || node.children.length === 0) {
      return node;
    }

    if (node.id === parentId) {
      const activeIndex = node.children.findIndex(child => child.id === activeId);
      const overIndex = node.children.findIndex(child => child.id === overId);

      if (activeIndex === -1 || overIndex === -1) {
        return node;
      }

      changed = true;
      return {
        ...node,
        children: arrayMove(node.children, activeIndex, overIndex),
      };
    }

    const reorderedChildren = reorderWithinParent(node.children, parentId, activeId, overId);
    if (reorderedChildren !== node.children) {
      changed = true;
      return {
        ...node,
        children: reorderedChildren,
      };
    }

    return node;
  });

  return changed ? nextNodes : nodes;
};

const getChildOrder = (nodes: Node[], parentId: number | null): number[] => {
  if (parentId === null) {
    return nodes.map(node => node.id);
  }

  for (const node of nodes) {
    if (node.id === parentId) {
      return (node.children ?? []).map(child => child.id);
    }

    if (node.children) {
      const nested = getChildOrder(node.children, parentId);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [];
};

// Check if targetId is a descendant of nodeId (to prevent circular moves)
const isDescendant = (nodes: Node[], nodeId: number, targetId: number): boolean => {
  const node = findNodeById(nodes, nodeId);
  if (!node || !node.children) {
    return false;
  }

  for (const child of node.children) {
    if (child.id === targetId) {
      return true;
    }
    if (isDescendant([child], child.id, targetId)) {
      return true;
    }
  }

  return false;
};

const moveNodeWithinTree = (nodes: Node[], nodeId: number, newParentId: number | null): Node[] => {
  let nodeToMove: Node | null = null;

  const removeNode = (items: Node[]): Node[] => {
    let changed = false;
    const result: Node[] = [];

    for (const item of items) {
      if (item.id === nodeId) {
        nodeToMove = item;
        changed = true;
        continue;
      }

      if (item.children) {
        const updatedChildren = removeNode(item.children);
        if (updatedChildren !== item.children) {
          changed = true;
          result.push({ ...item, children: updatedChildren });
          continue;
        }
      }

      result.push(item);
    }

    return changed ? result : items;
  };

  const rootsWithoutNode = removeNode(nodes);
  if (!nodeToMove) {
    return nodes;
  }

  const movedNode: Node = { ...nodeToMove, parent_id: newParentId };

  if (newParentId === null) {
    return [...rootsWithoutNode, movedNode];
  }

  const insertIntoParent = (items: Node[]): Node[] => {
    let changed = false;
    const result = items.map(item => {
      if (item.id === newParentId) {
        const children = item.children ? [...item.children, movedNode] : [movedNode];
        changed = true;
        return { ...item, children };
      }

      if (item.children) {
        const updatedChildren = insertIntoParent(item.children);
        if (updatedChildren !== item.children) {
          changed = true;
          return { ...item, children: updatedChildren };
        }
      }

      return item;
    });

    return changed ? result : items;
  };

  return insertIntoParent(rootsWithoutNode);
};
