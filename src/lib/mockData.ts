import { Project, Task } from '@/types/project';

export const mockTasks: Task[] = [
  {
    id: 't1',
    project_id: 'p1',
    title: 'Design system foundation',
    body: 'Create color palette, typography scale, and spacing tokens',
    status: 'done',
    position: 0,
    assignee: 'JD',
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    id: 't2',
    project_id: 'p1',
    title: 'Component architecture',
    body: 'Plan component hierarchy and data flow',
    status: 'in_progress',
    position: 1,
    assignee: 'SK',
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    id: 't3',
    project_id: 'p1',
    title: 'Setup build pipeline',
    status: 'todo',
    position: 2,
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    id: 't4',
    project_id: 'p2',
    title: 'User authentication flow',
    body: 'Implement login, signup, and password reset',
    status: 'in_progress',
    position: 0,
    assignee: 'JD',
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    id: 't5',
    project_id: 'p2',
    title: 'API documentation',
    status: 'todo',
    position: 1,
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    id: 't6',
    project_id: 'p3',
    title: 'Product requirements doc',
    body: 'Gather requirements from stakeholders',
    status: 'done',
    position: 0,
    assignee: 'AM',
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    id: 't7',
    project_id: 'p3',
    title: 'Competitive analysis',
    status: 'in_progress',
    position: 1,
    assignee: 'AM',
    updated_at: new Date().toISOString(),
    version: 1,
  },
];

export const mockProjects: Project[] = [
  {
    id: 'p1',
    name: 'Frontend Development',
    description: 'Core UI components and design system implementation',
    path: 'p1',
    created_at: new Date().toISOString(),
    tasks: mockTasks.filter(t => t.project_id === 'p1'),
  },
  {
    id: 'p2',
    name: 'Backend API',
    description: 'REST API and authentication services',
    path: 'p1.p2',
    parent_id: 'p1',
    created_at: new Date().toISOString(),
    tasks: mockTasks.filter(t => t.project_id === 'p2'),
  },
  {
    id: 'p3',
    name: 'Product Strategy',
    description: 'Planning and research initiatives',
    path: 'p3',
    created_at: new Date().toISOString(),
    tasks: mockTasks.filter(t => t.project_id === 'p3'),
  },
  {
    id: 'p4',
    name: 'Marketing',
    path: 'p3.p4',
    parent_id: 'p3',
    created_at: new Date().toISOString(),
    tasks: [],
  },
  {
    id: 'p5',
    name: 'Customer Research',
    path: 'p3.p5',
    parent_id: 'p3',
    created_at: new Date().toISOString(),
    tasks: [],
  },
];

// Build tree structure
export function buildTree(projects: Project[]): Project[] {
  const projectMap = new Map(projects.map(p => [p.id, { ...p, children: [] as Project[] }]));
  const roots: Project[] = [];

  projects.forEach(project => {
    const node = projectMap.get(project.id)!;
    if (project.parent_id) {
      const parent = projectMap.get(project.parent_id);
      if (parent) {
        parent.children!.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export const projectTree = buildTree(mockProjects);
