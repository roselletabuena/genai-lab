const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Document {
    key: string;
    filename?: string;
    size?: number;
    lastModified?: string;
}

export const api = {
    baseUrl: API_URL,

    async uploadDocument(file: File): Promise<{ message: string; document: Document }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_URL}/documents/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        return response.json();
    },

    async fetchDocuments(): Promise<{ count: number; documents: Document[] }> {
        const response = await fetch(`${API_URL}/documents`);

        if (!response.ok) {
            throw new Error(`Failed to fetch documents: ${response.statusText}`);
        }

        return response.json();
    },

    async deleteDocument(key: string): Promise<{ key: string; message: string }> {
        const response = await fetch(`${API_URL}/documents/${key}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`Delete failed: ${response.statusText}`);
        }

        return response.json();
    }
};

