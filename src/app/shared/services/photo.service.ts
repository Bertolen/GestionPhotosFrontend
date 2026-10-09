import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { Photo, PhotoUploadResponse, PhotoUploadMultipleResponse } from '../models/photo.model';
import { getPhotoApiUrl } from '../config/runtime-config';

/**
 * Service Angular pour communiquer avec l'API Spring Boot.
 * Gère toutes les opérations CRUD sur les photos.
 */
@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  
  private readonly http = inject(HttpClient);
  
  private readonly apiUrl = getPhotoApiUrl();
  
  // Headers pour les requêtes
  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  /**
   * Upload une photo.
   * 
   * @param file le fichier à uploader
   * @returns Observable avec la réponse de l'API
   */
  uploadPhoto(file: File): Observable<Photo> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    
    return this.http.post<Photo>(`${this.apiUrl}/upload`, formData).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Upload plusieurs photos.
   * 
   * @param files les fichiers à uploader
   * @returns Observable avec la liste des photos uploadées
   */
  uploadPhotos(files: File[]): Observable<Photo[]> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append('files', file, file.name);
    });
    
    return this.http.post<Photo[]>(`${this.apiUrl}/upload/multiple`, formData).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Upload une photo avec sa date de création.
   * 
   * @param file le fichier à uploader
   * @param creationDate la date de création de la photo
   * @returns Observable avec la réponse de l'API
   */
  uploadPhotoWithDate(file: File, creationDate: Date): Observable<PhotoUploadResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('creationDate', creationDate.toISOString());
    
    return this.http.post<PhotoUploadResponse>(`${this.apiUrl}/upload/single-with-date`, formData).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Upload plusieurs photos avec leurs dates de création.
   * 
   * @param files les fichiers à uploader
   * @param creationDates les dates de création des photos
   * @returns Observable avec la liste des photos uploadées
   */
  uploadPhotosWithDates(files: File[], creationDates: Date[]): Observable<PhotoUploadMultipleResponse> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append('files', file, file.name);
    });
    creationDates.forEach((date) => {
      formData.append('creationDates', date.toISOString());
    });
    
    return this.http.post<PhotoUploadMultipleResponse>(`${this.apiUrl}/upload/multiple-with-date`, formData).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère la liste de toutes les photos.
   * 
   * @returns Observable avec la liste des photos
   */
  getAllPhotos(): Observable<Photo[]> {
    return this.http.get<Photo[]>(this.apiUrl).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère une photo par son ID.
   * 
   * @param id l'ID de la photo
   * @returns Observable avec la photo correspondante
   */
  getPhotoById(id: string): Observable<Photo> {
    return this.http.get<Photo>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  getPhotoUrl(id: string): string {
    return `${this.apiUrl}/${encodeURIComponent(id)}/download`;
  }

  /**
   * Télécharge une photo.
   * 
   * @param id l'ID de la photo à télécharger
   * @returns Observable avec le blob du fichier
   */
  downloadPhoto(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download`, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Télécharge plusieurs photos dans une archive ZIP.
   *
   * @param ids identifiants des photos à télécharger
   * @returns Observable avec le fichier ZIP
   */
  downloadPhotosBulk(ids: string[]): Observable<Blob> {
    let params = new HttpParams();
    ids.forEach((id) => {
      params = params.append('photoIds', id);
    });

    return this.http.post(`${this.apiUrl}/download/bulk`, null, {
      params,
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Supprime une photo.
   * 
   * @param id l'ID de la photo à supprimer
   * @returns Observable avec un message de confirmation
   */
  deletePhoto(id: string): Observable<string> {
    return this.http.delete<string>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Supprime plusieurs photos.
   * 
   * @param photoIds les identifiants des photos à supprimer
   * @returns Observable avec un message de confirmation
   */
  deletePhotos(photoIds: string[]): Observable<Map<string, object>> {
    let params = new HttpParams();
    photoIds.forEach((id) => {
      params = params.append('photoIds', id);
    });

    return this.http.delete<Map<string, object>>(`${this.apiUrl}/multiple`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les métadonnées d'une photo.
   * 
   * @param id l'ID de la photo
   * @returns Observable avec les métadonnées
   */
  getPhotoMetadata(id: string): Observable<Photo> {
    return this.http.get<Photo>(`${this.apiUrl}/${id}/metadata`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Vérifie si le service est opérationnel.
   * 
   * @returns Observable avec un message de statut
   */
  checkStatus(): Observable<string> {
    return this.http.get<string>(`${this.apiUrl}/status`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les photos dans une plage de dates.
   * 
   * @param fromDate date de début (ISO string)
   * @param toDate date de fin (ISO string)
   * @returns Observable avec la liste des photos filtrées
   */
  getPhotosByDateRange(fromDate: string, toDate: string): Observable<Photo[]> {
    return this.http.get<Photo[]>(`${this.apiUrl}/by-date`, {
      params: {
        fromDate: fromDate,
        toDate: toDate
      }
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Gère les erreurs HTTP.
   * 
   * @param error l'erreur HTTP
   * @returns Observable avec l'erreur
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur inconnue est survenue';
    
    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      if (error.status === 400) {
        errorMessage = 'Requête invalide. Vérifiez les données envoyées.';
      } else if (error.status === 404) {
        errorMessage = 'Ressource non trouvée.';
      } else if (error.status === 403 || error.status === 401) {
        errorMessage = 'Non autorisé. Accès refusé.';
      } else if (error.status === 500) {
        errorMessage = 'Erreur interne du serveur.';
      } else {
        errorMessage = `Code d\'erreur: ${error.status}\nMessage: ${error.message}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }
}
