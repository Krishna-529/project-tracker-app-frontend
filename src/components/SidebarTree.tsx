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
import { ChevronRight, Folder, FolderOpen, MoreVertical, Pencil, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { Node } from '@/types/node';
import { ProjectPickerModal } from './ProjectPickerModal';

interface SidebarTreeProps {
  nodes: Node[];
  allProjects?: Node[];
  selectedId: number | null;
  onSelect: (nodeId: number) => void;
  onAddProject: (parentId?: number, name?: string) => void;
  onAddTask: (projectId: number, name?: string) => void;
  onRename?: (nodeId: number, newName: string) => void;
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
    latestNodesRef.current = nodes;
    if (!isSyncingRef.current) {
      setTreeData(nodes);
    }
  }, [nodes]);

  // Cleanup debounce on unmount
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(Number(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeId = Number(active.id);
    const overId = Number(over.id);

    if (activeId === overId) {
      return;
    }

    const activeParentId = (active.data.current?.parentId ?? null) as number | null;
    const overParentId = (over.data.current?.parentId ?? null) as number | null;

    // Same parent - just reorder
    if (activeParentId === overParentId) {
      const updatedTree = reorderWithinParent(treeData, activeParentId, activeId, overId);
      if (updatedTree === treeData) {
        return;
      }

      // Optimistic update
      setTreeData(updatedTree);

      // Debounce API call to prevent race conditions
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const orderedIds = getChildOrder(updatedTree, activeParentId);
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
      return;
    }

    // Different parent - check if dropping onto a project for reparenting
    const overNode = findNodeById(treeData, overId);
    if (overNode && !overNode.is_task) {
      // Don't allow dropping a node onto its own descendant
      if (isDescendant(treeData, activeId, overId)) {
        return;
      }
      if (onMove) {
        const updatedTree = moveNodeWithinTree(treeData, activeId, overId);
        setTreeData(updatedTree);
        isSyncingRef.current = true;
        const maybePromise = onMove(activeId, overId);
        if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
          void (maybePromise as Promise<unknown>)
            .then(() => {
              isSyncingRef.current = false;
            })
            .catch(() => {
              isSyncingRef.current = false;
              setTreeData(latestNodesRef.current);
            });
        } else {
          isSyncingRef.current = false;
        }
      }
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
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

        <div className="p-3 overflow-y-auto flex-1" onWheel={handleWheel}>
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
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
                  level={0}
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
  level: number;
}

function TreeNode({ node, parentId, selectedId, onSelect, onAddProject, onAddTask, onRename, level }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [showAddInput, setShowAddInput] = useState(false);
  const [addInputType, setAddInputType] = useState<'project' | 'task'>('project');
  const [addName, setAddName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const childNodes = node.children ?? [];
  const canExpand = !node.is_task;
  const isSelected = selectedId === node.id;

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
    if (!trimmedName) return;

    if (addInputType === 'project') {
      onAddProject(node.id, trimmedName);
    } else if (onAddTask) {
      onAddTask(node.id, trimmedName);
    }

    setAddName('');
    setShowAddInput(false);
  };

  const handleStartAdd = (type: 'project' | 'task') => {
    if (node.is_task) {
      return;
    }
    setAddInputType(type);
    setAddName('');
    setShowAddInput(true);
    setIsExpanded(true);
  };

  const handleClick = () => {
    onSelect(node.id);
    if (canExpand) {
      setIsExpanded(prev => !prev);
    }
  };

  const rowStyle: CSSProperties = {
    paddingLeft: `${level * 20 + 8}px`,
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.6 : 1,
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

  return (
    <div className="relative">
      {level > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 w-px bg-border"
          style={{ left: `${(level - 1) * 20 + 10}px` }}
        />
      )}

      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={cn(
          'group flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-all select-none',
          'hover:bg-secondary/50',
          isSelected
            ? 'bg-secondary border-l-3 border-accent font-medium shadow-sm'
            : 'border-l-3 border-transparent hover-border-accent/30',
          isDragging && 'cursor-grabbing',
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
          <FolderOpen className={cn('w-4 h-4 flex-shrink-0', isSelected ? 'text-accent' : 'text-muted-foreground')} />
        ) : (
          <Folder className={cn('w-4 h-4 flex-shrink-0', isSelected ? 'text-accent' : 'text-muted-foreground')} />
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
          <span
            className={cn(
              'text-sm truncate flex-1',
              node.is_task && node.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            {node.name}
          </span>
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
                {!node.is_task && (
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
                    {onRename && <div className="h-px bg-border my-0.5" />}
                  </>
                )}
                {onRename && (
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
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {!node.is_task && isExpanded && (
        <div className="animate-accordion-down">
          <SortableContext items={childNodes.map(child => child.id)} strategy={verticalListSortingStrategy}>
            {childNodes.map(child => (
              <TreeNode
                key={child.id}
                node={child}
                parentId={node.id}
                selectedId={selectedId}
                onSelect={onSelect}
                onAddProject={onAddProject}
                onAddTask={onAddTask}
                onRename={onRename}
                level={level + 1}
              />
            ))}
          </SortableContext>

          {showAddInput && (
            <div className="relative" style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}>
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
        </div>
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
