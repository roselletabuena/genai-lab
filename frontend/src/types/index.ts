export type DocumentStatus = 'processing' | 'ready' | 'error';

export interface Document {
    id: string;
    filename: string;
    uploadedAt: string;
    size: number;
    status: DocumentStatus;
    pageCount?: number;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}
