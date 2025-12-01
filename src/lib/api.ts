import type { NodeStatus } from '@/types/node';

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  ?? DEFAULT_API_BASE_URL;

export interface ApiNode {
  id: number;
  name: string;
  parentId: number | null;
  isTask: boolean;
  status: NodeStatus;
  path: string;
  sortOrder: number;
}

interface TreeResponse {
  data: ApiNode[];
  meta: {
    count: number;
    lastUpdated: string | null;
  };
}

export const fetchNodeTree = async (etag?: string): Promise<{ nodes: ApiNode[]; etag?: string | null }> => {
  const response = await fetch(`${API_BASE_URL}/nodes/tree`, {
    headers: etag ? { 'If-None-Match': etag } : undefined,
    credentials: 'include',
  });

  if (response.status === 304) {
    return { nodes: [], etag: response.headers.get('etag') };
  }

  if (!response.ok) {
    throw new Error(`Failed to load node tree: ${response.statusText}`);
  }

  const payload = (await response.json()) as TreeResponse;
  const newEtag = response.headers.get('etag');

  return { nodes: payload.data, etag: newEtag };
};

interface NodeDetailResponse {
  data: {
    id: number;
    name: string;
    isTask: boolean;
    parentId: number | null;
    path: string;
    status: NodeStatus;
    metaDescription?: string | null;
    deadline?: string | null;
    notes?: string | null;
    partsCompleted?: number | null;
    data?: Record<string, unknown> | null;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  };
}

export const fetchNodeById = async (id: number) => {
  const response = await fetch(`${API_BASE_URL}/nodes/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to load node ${id}: ${response.statusText}`);
  }

  return (await response.json()) as NodeDetailResponse;
};

interface CreateNodeRequest {
  name: string;
  isTask: boolean;
  parentId?: number | null;
  status?: NodeStatus;
}

export const createNode = async (payload: CreateNodeRequest) => {
  const response = await fetch(`${API_BASE_URL}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create node: ${response.statusText}`);
  }

  return response.json();
};

interface UpdateNodeRequest {
  name?: string;
  status?: NodeStatus;
  notes?: string;
  metaDescription?: string | null;
}

export const updateNode = async (id: number, payload: UpdateNodeRequest) => {
  const response = await fetch(`${API_BASE_URL}/nodes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update node ${id}: ${response.statusText}`);
  }

  return response.json();
};

interface MoveNodeRequest {
  nodeId: number;
  newParentId: number | null;
}

export const moveNode = async (payload: MoveNodeRequest) => {
  console.log('[API] moveNode called with:', payload);
  const response = await fetch(`${API_BASE_URL}/nodes/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[API] moveNode failed:', response.status, errorData);
    throw new Error(`Failed to move node: ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  return response.json();
};

interface ReorderNodesRequest {
  parentId?: number | null;
  orderedIds: number[];
}

export const reorderNodes = async (payload: ReorderNodesRequest) => {
  const response = await fetch(`${API_BASE_URL}/nodes/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to reorder nodes: ${response.statusText}`);
  }

  return response.json();
};

export const deleteNode = async (nodeId: number) => {
  const response = await fetch(`${API_BASE_URL}/nodes/${nodeId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete node ${nodeId}: ${response.statusText}`);
  }

  return response.json();
};
