/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_ENV: string
    readonly API_URL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
