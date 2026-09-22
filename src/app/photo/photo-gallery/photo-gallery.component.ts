import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { PhotoService } from '../../shared/services/photo.service';
import { Photo } from '../../shared/models/photo.model';
import { DateFormatPipe, DateOnlyPipe } from '../../shared/pipes/date-format.pipe';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';

@Component({
  selector: 'app-photo-gallery',
  standalone: true,
  imports: [CommonModule, DateFormatPipe, DateOnlyPipe, FileSizePipe],
  template: `
    <section class="gallery-container">
      <header class="gallery-header">
        <div>
          <p class="eyebrow">Photos</p>
          <h1>Galerie</h1>
        </div>
        <button type="button" class="refresh-button" (click)="loadPhotos()">
          Rafraîchir
        </button>
      </header>

      <div *ngIf="photos.length > 0" class="selection-toolbar">
        <span>{{ selectedPhotoIds.size }} photo(s) sélectionnée(s)</span>
        <button
          type="button"
          class="download-button"
          [disabled]="selectedPhotoIds.size === 0 || downloading"
          (click)="downloadSelectedPhotos()"
        >
          {{ downloading ? 'Téléchargement...' : 'Télécharger la sélection' }}
        </button>
      </div>

      <div *ngIf="loading" class="status-box info">Chargement des photos...</div>
      <div *ngIf="errorMessage" class="status-box error">{{ errorMessage }}</div>

      <div *ngIf="!loading && !errorMessage && photos.length === 0" class="empty-state">
        <p>Aucune photo disponible pour le moment.</p>
      </div>

      <div *ngIf="photos.length > 0" class="gallery-grid">
        <article
          class="photo-card"
          *ngFor="let photo of photos"
          [class.selected]="selectedPhotoIds.has(photo.id)"
          role="button"
          tabindex="0"
          [attr.aria-pressed]="selectedPhotoIds.has(photo.id)"
          [attr.aria-label]="
            (selectedPhotoIds.has(photo.id) ? 'Désélectionner ' : 'Sélectionner ')
            + (photo.originalName || photo.fileName)
          "
          (click)="togglePhotoSelection(photo.id)"
          (keydown.enter)="togglePhotoSelection(photo.id)"
          (keydown.space)="togglePhotoSelection(photo.id); $event.preventDefault()"
        >
          <div class="image-preview">
            <img
              *ngIf="!failedImageIds.has(photo.id)"
              [src]="getPhotoUrl(photo.id)"
              [alt]="photo.originalName || photo.fileName"
              loading="lazy"
              (error)="onImageError(photo.id)"
            />
            <div *ngIf="failedImageIds.has(photo.id)" class="image-placeholder">
              <span aria-hidden="true">📷</span>
              <span>Miniature indisponible</span>
            </div>
          </div>
          <div class="photo-info">
            <h3>{{ photo.originalName || photo.fileName }}</h3>
            <ul>
              <li><strong>Taille :</strong> {{ photo.size | fileSize }}</li>
              <li><strong>Type :</strong> {{ photo.mimeType || 'Inconnu' }}</li>
              <li><strong>Ajoutée le :</strong> {{ photo.uploadDate | dateFormat }}</li>
              <li><strong>Création :</strong> {{ photo.creationDate | dateOnly }}</li>
            </ul>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: [`
    .gallery-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 0;
    }

    .gallery-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      gap: 16px;
    }

    .eyebrow {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 12px;
      color: #607d8b;
    }

    h1 {
      margin: 6px 0 0;
      font-size: 2rem;
    }

    .refresh-button {
      border: none;
      background: #2196F3;
      color: white;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }

    .selection-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
      padding: 12px 16px;
      background: #f5faff;
      border: 1px solid #bbdefb;
      border-radius: 10px;
      color: #455a64;
      font-weight: 600;
    }

    .download-button {
      border: none;
      background: #4caf50;
      color: white;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }

    .download-button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .status-box {
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-weight: 500;
    }

    .status-box.info {
      background: #e3f2fd;
      color: #0d47a1;
    }

    .status-box.error {
      background: #ffebee;
      color: #c62828;
    }

    .empty-state {
      background: #f5f5f5;
      border: 1px dashed #b0bec5;
      border-radius: 12px;
      padding: 40px 16px;
      text-align: center;
      color: #546e7a;
    }

    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }

    .photo-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border: 1px solid #e0e0e0;
      cursor: pointer;
    }

    .photo-card.selected {
      border: 2px solid #0d47a1;
      box-shadow: 0 0 0 2px rgba(13, 71, 161, 0.25);
    }

    .image-preview {
      height: 180px;
      background: linear-gradient(135deg, #e3f2fd, #bbdefb);
    }

    .image-preview img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .image-placeholder {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 8px;
      font-size: 54px;
      color: #546e7a;
    }

    .image-placeholder span:last-child {
      font-size: 0.85rem;
      font-weight: 600;
    }

    .photo-info {
      padding: 16px;
    }

    .photo-info h3 {
      margin: 0 0 12px;
      font-size: 1.1rem;
      word-break: break-word;
    }

    .photo-info ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 6px;
      color: #455a64;
      font-size: 0.95rem;
    }
  `]
})
export class PhotoGalleryComponent implements OnInit {
  private readonly photoService = inject(PhotoService);

  photos: Photo[] = [];
  selectedPhotoIds = new Set<string>();
  failedImageIds = new Set<string>();
  loading = false;
  downloading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadPhotos();
  }

  loadPhotos(): void {
    this.loading = true;
    this.errorMessage = '';

    this.photoService.getAllPhotos().subscribe({
      next: (photos) => {
        this.photos = photos;
        this.selectedPhotoIds.clear();
        this.failedImageIds.clear();
        this.loading = false;
      },
      error: (err: Error) => {
        this.loading = false;
        this.errorMessage = err.message || 'Impossible de charger la galerie.';
      }
    });
  }

  getPhotoUrl(photoId: string): string {
    return `http://localhost:8080/api/photos/${encodeURIComponent(photoId)}/download`;
  }

  onImageError(photoId: string): void {
    this.failedImageIds.add(photoId);
  }

  togglePhotoSelection(photoId: string): void {
    if (this.selectedPhotoIds.has(photoId)) {
      this.selectedPhotoIds.delete(photoId);
    } else {
      this.selectedPhotoIds.add(photoId);
    }
  }

  downloadSelectedPhotos(): void {
    const selectedPhotos = this.photos.filter((photo) => this.selectedPhotoIds.has(photo.id));

    if (selectedPhotos.length === 0 || this.downloading) {
      return;
    }

    this.downloading = true;
    this.errorMessage = '';

    forkJoin(selectedPhotos.map((photo) => this.photoService.downloadPhoto(photo.id))).subscribe({
      next: (blobs) => {
        blobs.forEach((blob, index) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = selectedPhotos[index].originalName || selectedPhotos[index].fileName;
          link.click();
          URL.revokeObjectURL(url);
        });
        this.downloading = false;
      },
      error: (err: Error) => {
        this.downloading = false;
        this.errorMessage = err.message || 'Impossible de télécharger la sélection.';
      }
    });
  }
}
