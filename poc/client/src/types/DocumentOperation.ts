export interface DocumentOperation {
  type: 'insert' | 'delete' | 'replace' | 'retain';
  position: number;
  content?: string;
  length?: number;
  timestamp: number;
  id?: string;
  userId?: string;
  version?: number;
  clientId?: string;
}
