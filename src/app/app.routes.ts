import { Routes } from '@angular/router';
import { PhotoGalleryComponent } from './photo/photo-gallery/photo-gallery.component';
import { PhotoUploadComponent } from './photo/photo-upload/photo-upload.component';

/**
 * Routes de l'application.
 * Définit les chemins et les composants associés.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'photos'
  },
  {
    path: 'photos',
    component: PhotoGalleryComponent,
    title: 'Galerie de photos'
  },
  {
    path: 'upload',
    component: PhotoUploadComponent,
    title: 'Uploader des photos'
  },
  {
    path: '**',
    redirectTo: 'photos'
  }
];
