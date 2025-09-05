import { useCallback } from 'react';

interface Document {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  activeUsers: User[];
}

interface User {
  id: string;
  name: string;
  color: string;
  avatar: string;
}

export const useDocument = () => {
  const loadDocument = useCallback(async (documentId: string): Promise<Document | null> => {
    try {
      const response = await fetch(`/api/documents/${documentId}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error loading document:', error);
      return null;
    }
  }, []);

  return {
    loadDocument
  };
};
