interface AppRuntimeConfig {
  apiBaseUrl?: string;
}

declare global {
  interface Window {
    __appConfig?: AppRuntimeConfig;
  }
}

const DEFAULT_API_BASE_URL = 'http://localhost:8080';

export function getPhotoApiUrl(): string {
  const configuredBaseUrl = typeof window === 'undefined'
    ? undefined
    : window.__appConfig?.apiBaseUrl;
  const baseUrl = (configuredBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');

  return `${baseUrl}/api/photos`;
}
