import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PhotoService } from '../../shared/services/photo.service';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';

@Component({
  selector: 'app-photo-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, FileSizePipe],
  template: `
    <section class="upload-container">
      <div class="upload-card">
        <p class="eyebrow">Téléversement</p>
        <h1>Uploader des photos</h1>

        <label class="drop-zone" for="photo-input">
          <input
            id="photo-input"
            type="file"
            accept="image/*"
            multiple
            (change)="onFileSelected($event)"
          />
          <span>Choisir des images</span>
        </label>

        <div *ngIf="selectedFiles.length > 0" class="file-list">
          <h3>Fichiers sélectionnés</h3>
          <ul>
            <li *ngFor="let file of selectedFiles">{{ file.name }} ({{ file.size | fileSize }})</li>
          </ul>
        </div>

        <button
          type="button"
          class="upload-button"
          [disabled]="selectedFiles.length === 0 || uploading"
          (click)="uploadFiles()"
        >
          {{ uploading ? 'Téléversement...' : 'Téléverser' }}
        </button>

        <div *ngIf="errorMessage" class="status-box error">{{ errorMessage }}</div>
        <div *ngIf="successMessage" class="status-box success">{{ successMessage }}</div>
      </div>
    </section>
  `,
  styles: [
    `.upload-container {
      max-width: 700px;
      margin: 0 auto;
      padding: 24px 0;
    }

    .upload-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      border: 1px solid #e0e0e0;
    }

    .eyebrow {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 12px;
      color: #607d8b;
    }

    h1 {
      margin: 6px 0 20px;
      font-size: 2rem;
    }

    .drop-zone {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 140px;
      border: 2px dashed #90caf9;
      background: #f5faff;
      border-radius: 12px;
      cursor: pointer;
      text-align: center;
      color: #1565c0;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .drop-zone input {
      display: none;
    }

    .file-list {
      margin-bottom: 16px;
    }

    .file-list h3 {
      margin-bottom: 8px;
    }

    .file-list ul {
      margin: 0;
      padding-left: 18px;
      color: #455a64;
    }

    .upload-button {
      border: none;
      background: #4caf50;
      color: white;
      padding: 12px 18px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      width: 100%;
    }

    .upload-button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .status-box {
      margin-top: 16px;
      border-radius: 10px;
      padding: 12px 16px;
      font-weight: 500;
    }

    .status-box.error {
      background: #ffebee;
      color: #c62828;
    }

    .status-box.success {
      background: #e8f5e9;
      color: #2e7d32;
    }

    @media (max-width: 600px) {
      .upload-container {
        padding: 12px 0;
      }

      .upload-card {
        padding: 16px;
        border-radius: 10px;
      }

      h1 {
        margin-bottom: 16px;
        font-size: 1.5rem;
      }

      .drop-zone {
        min-height: 110px;
        margin-bottom: 12px;
        padding: 16px;
        font-size: 0.9rem;
      }

      .file-list {
        margin-bottom: 12px;
        font-size: 0.85rem;
      }

      .file-list h3 {
        font-size: 1rem;
      }

      .upload-button {
        padding: 10px 14px;
        font-size: 0.9rem;
      }

      .status-box {
        margin-top: 12px;
        padding: 10px 12px;
        font-size: 0.85rem;
      }
    }
  `]
})
export class PhotoUploadComponent {
  private readonly photoService = inject(PhotoService);

  selectedFiles: File[] = [];
  selectedFilesWithDates: { file: File; creationDate: Date | null }[] = [];
  uploading = false;
  errorMessage = '';
  successMessage = '';

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.selectedFiles = files;
    
    // Extraire les dates de création des fichiers
    this.selectedFilesWithDates = files.map(file => {
      // La propriété lastModified donne un timestamp en millisecondes
      // C'est la date de dernière modification, qui correspond généralement à la date de création pour les photos
      const timestamp = file.lastModified;
      const creationDate = timestamp > 0 ? new Date(timestamp) : null;
      return { file, creationDate };
    });
    
    this.errorMessage = '';
    this.successMessage = '';
  }

  uploadFiles(): void {
    if (this.selectedFiles.length === 0) {
      this.errorMessage = 'Sélectionnez au moins une image à téléverser.';
      return;
    }

    this.uploading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Vérifier si on a des dates de création
    const hasCreationDates = this.selectedFilesWithDates.every(f => f.creationDate !== null);
    
    if (this.selectedFiles.length === 1 && hasCreationDates) {
      // Cas d'une seule photo avec date
      const { file, creationDate } = this.selectedFilesWithDates[0];
      if (creationDate) {
        this.photoService.uploadPhotoWithDate(file, creationDate).subscribe({
          next: () => {
            this.handleUploadSuccess();
          },
          error: (err: Error) => {
            this.handleUploadError(err);
          }
        });
        return;
      }
    } else if (this.selectedFiles.length > 1 && hasCreationDates) {
      // Cas de plusieurs photos avec dates
      const files = this.selectedFilesWithDates.map(f => f.file);
      const creationDates = this.selectedFilesWithDates.map(f => f.creationDate!);
      this.photoService.uploadPhotosWithDates(files, creationDates).subscribe({
        next: () => {
          this.handleUploadSuccess();
        },
        error: (err: Error) => {
          this.handleUploadError(err);
        }
      });
      return;
    }

    // Cas de fallback : pas de dates de création disponibles, utiliser l'ancien endpoint
    this.photoService.uploadPhotos(this.selectedFiles).subscribe({
      next: () => {
        this.handleUploadSuccess();
      },
      error: (err: Error) => {
        this.handleUploadError(err);
      }
    });
  }

  private handleUploadSuccess(): void {
    this.uploading = false;
    this.successMessage = 'Les photos ont été téléversées avec succès.';
    this.selectedFiles = [];
    this.selectedFilesWithDates = [];
    const input = document.getElementById('photo-input') as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }

  private handleUploadError(err: Error): void {
    this.uploading = false;
    this.errorMessage = err.message || 'Le téléversement a échoué.';
  }
}
