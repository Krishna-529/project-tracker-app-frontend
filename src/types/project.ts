export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  body?: string;
  status: TaskStatus;
  position: number;
  assignee?: string;
  updated_at: string;
  version: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  parent_id?: string;
  created_at: string;
  children?: Project[];
  tasks?: Task[];
}
