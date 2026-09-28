import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PhotoService } from '../../shared/services/photo.service';
import { Photo } from '../../shared/models/photo.model';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';

@Component({
  selector: 'app-photo-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule, DateFormatPipe],
  templateUrl: './photo-gallery.component.html',
  styleUrls: ['./photo-gallery.component.scss']
})
export class PhotoGalleryComponent implements OnInit {
  private readonly photoService = inject(PhotoService);

  photos: Photo[] = [];
  selectedPhotoIds = new Set<string>();
  failedImageIds = new Set<string>();
  fromDate = '';
  toDate = '';
  pendingFromDate = '';
  pendingToDate = '';
  dateFilterOpen = false;
  downloadConfirmationOpen = false;
  downloadIndividually = false;
  loading = false;
  downloading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadPhotos();
  }

  loadPhotos(): void {
    this.loading = true;
    this.errorMessage = '';

    const request = this.fromDate || this.toDate
      ? this.photoService.getPhotosByDateRange(
          this.fromDate ? `${this.fromDate}T00:00:00` : '0001-01-01T00:00:00',
          this.toDate ? `${this.toDate}T23:59:59` : '9999-12-31T23:59:59'
        )
      : this.photoService.getAllPhotos();

    request.subscribe({
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

  applyDateFilter(): void {
    if (this.pendingFromDate && this.pendingToDate && this.pendingFromDate > this.pendingToDate) {
      this.errorMessage = 'La date de début doit être antérieure ou égale à la date de fin.';
      return;
    }

    this.fromDate = this.pendingFromDate;
    this.toDate = this.pendingToDate;
    this.dateFilterOpen = false;
    this.loadPhotos();
  }

  openDateFilter(): void {
    this.pendingFromDate = this.fromDate;
    this.pendingToDate = this.toDate;
    this.dateFilterOpen = true;
  }

  cancelDateFilter(): void {
    this.dateFilterOpen = false;
  }

  openDownloadConfirmation(): void {
    if (this.selectedPhotoIds.size > 0 && !this.downloading) {
      this.downloadIndividually = false;
      this.downloadConfirmationOpen = true;
    }
  }

  cancelDownload(): void {
    this.downloadConfirmationOpen = false;
  }

  confirmDownload(): void {
    this.downloadConfirmationOpen = false;
    if (this.selectedPhotoIds.size > 1 && !this.downloadIndividually) {
      this.downloadSelectedPhotosAsZip();
      return;
    }

    this.downloadSelectedPhotos();
  }

  clearDateFilter(): void {
    this.fromDate = '';
    this.toDate = '';
    this.pendingFromDate = '';
    this.pendingToDate = '';
    this.loadPhotos();
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

  areAllPhotosSelected(): boolean {
    return this.photos.length > 0
      && this.photos.every((photo) => this.selectedPhotoIds.has(photo.id));
  }

  toggleSelectAll(): void {
    if (this.areAllPhotosSelected()) {
      this.photos.forEach((photo) => this.selectedPhotoIds.delete(photo.id));
      return;
    }

    this.photos.forEach((photo) => this.selectedPhotoIds.add(photo.id));
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

  private downloadSelectedPhotosAsZip(): void {
    const selectedPhotoIds = this.photos
      .filter((photo) => this.selectedPhotoIds.has(photo.id))
      .map((photo) => photo.id);

    if (selectedPhotoIds.length < 2 || this.downloading) {
      return;
    }

    this.downloading = true;
    this.errorMessage = '';

    this.photoService.downloadPhotosBulk(selectedPhotoIds).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'photos.zip';
        link.click();
        URL.revokeObjectURL(url);
        this.downloading = false;
      },
      error: (err: Error) => {
        this.downloading = false;
        this.errorMessage = err.message || 'Impossible de télécharger la sélection.';
      }
    });
  }
}
