import { getPhotoApiUrl } from './runtime-config';

describe('getPhotoApiUrl', () => {
  const originalConfig = window.__appConfig;

  afterEach(() => {
    window.__appConfig = originalConfig;
  });

  it('uses localhost when no runtime URL is configured', () => {
    window.__appConfig = undefined;

    expect(getPhotoApiUrl()).toBe('http://localhost:8080/api/photos');
  });

  it('uses the configured base URL and removes a trailing slash', () => {
    window.__appConfig = { apiBaseUrl: 'http://192.168.1.20:8080/' };

    expect(getPhotoApiUrl()).toBe('http://192.168.1.20:8080/api/photos');
  });
});
