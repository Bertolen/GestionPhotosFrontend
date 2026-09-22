/**
 * Modèle TypeScript pour une photo.
 * Correspond au DTO PhotoDto côté backend.
 */
export interface Photo {
  id: string;
  originalName: string;
  storedPath: string;
  fileName: string;
  size: number;
  mimeType: string;
  uploadDate: Date;
  creationDate: Date;
}

/**
 * Réponse de l'API pour une liste de photos.
 */
export interface PhotoListResponse {
  photos: Photo[];
}

/**
 * Réponse de l'API pour l'upload d'une photo.
 */
export interface PhotoUploadResponse {
  photo: Photo;
  message?: string;
}

/**
 * Réponse de l'API pour l'upload de plusieurs photos.
 */
export interface PhotoUploadMultipleResponse {
  photos: Photo[];
  message?: string;
}

/**
 * Informations de pagination.
 */
export interface PageInfo {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Réponse paginée de photos.
 */
export interface PaginatedPhotoResponse {
  content: Photo[];
  page: PageInfo;
}
