import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PhotoService } from '../../shared/services/photo.service';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';

@Component({
  selector: 'app-photo-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, FileSizePipe],
  templateUrl: './photo-upload.component.html',
  styleUrls: ['./photo-upload.component.scss']
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
