/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Track B REST API base URL (e.g. http://localhost:3001) */
  readonly VITE_TRACK_B_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
