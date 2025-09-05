export interface User {
  id: string;
  name: string;
  color: string;
  avatar: string;
  socketId?: string;
  cursor?: {
    position: number;
    selection?: any;
  };
  joinedAt?: string;
  lastCursorUpdate?: string;
}
