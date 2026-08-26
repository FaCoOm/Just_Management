/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Current REST API base URL (e.g. http://localhost:3001) */
  readonly VITE_TRACK_B_API_URL?: string;
  /** Backend route that issues WithOne AuthKit tokens. */
  readonly VITE_ONE_AUTH_TOKEN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
