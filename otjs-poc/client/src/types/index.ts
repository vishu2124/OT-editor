export interface User {
  id: string;
  name: string;
  color: string;
  avatar: string;
  socketId?: string;
  cursor?: {
    position: number;
    selection: number | null;
  };
}

export interface Document {
  id: string;
  title: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  activeUsers: User[];
}

export interface DocumentState {
  content: string;
  version: number;
  activeUsers: User[];
}

export interface Operation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  userId: string;
  timestamp: number;
  clientId: string;
}

export interface CursorUpdate {
  user: User;
  cursor: {
    position: number;
    selection: number | null;
  };
  timestamp: number;
}
