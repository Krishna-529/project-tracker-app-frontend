export type NodeStatus = 'todo' | 'in_progress' | 'done' | 'archived';

export interface Node {
  id: number;
  name: string;
  is_task: boolean;
  parent_id: number | null;
  path: string;
  status: NodeStatus;
  meta_description?: string;
  deadline?: string | null;
  notes?: string;
  parts_completed?: number;
  sort_order: number;
  children?: Node[];
}

export interface CreateNodeInput {
  name: string;
  is_task: boolean;
  parent_id: number | null;
  status?: NodeStatus;
  meta_description?: string;
  deadline?: string | null;
  notes?: string;
}

export interface UpdateNodeInput {
  id: number;
  name?: string;
  status?: NodeStatus;
  meta_description?: string;
  deadline?: string | null;
  notes?: string;
  parts_completed?: number;
}

export interface MoveNodeInput {
  moving_id: number;
  new_parent_id: number | null;
  new_sort_order?: number;
}
