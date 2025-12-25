
export interface Document {
    key: string;
    filename?: string;
    size?: number;
    lastModified?: string;
}

export interface ErrorDetails {
    error: string;
    details?: string;
}

export const api = {
    baseUrl: import.meta.env.VITE_API_URL,

    async uploadDocument(file: File): Promise<{ message: string; document: Document }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseUrl}/documents/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json() as ErrorDetails;
            const errorMessage = errorData.details
                ? `${errorData.error} (${errorData.details})`
                : errorData.error || `Upload failed: ${response.statusText}`;
            throw new Error(errorMessage);
        }

        return response.json();
    },

    async fetchDocuments(): Promise<{ count: number; documents: Document[] }> {
        const response = await fetch(`${this.baseUrl}/documents`);

        if (!response.ok) {
            throw new Error(`Failed to fetch documents: ${response.statusText}`);
        }

        return response.json();
    },

    async deleteDocument(key: string): Promise<{ key: string; message: string }> {
        const response = await fetch(`${this.baseUrl}/documents/${key}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`Delete failed: ${response.statusText}`);
        }

        return response.json();
    }
};

