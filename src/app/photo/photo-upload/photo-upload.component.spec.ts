import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PhotoUploadComponent } from './photo-upload.component';
import { PhotoService } from '../../shared/services/photo.service';
import { Photo } from '../../shared/models/photo.model';

describe('PhotoUploadComponent', () => {
  let fixture: ComponentFixture<PhotoUploadComponent>;
  let component: PhotoUploadComponent;
  let photoService: jasmine.SpyObj<PhotoService>;

  beforeEach(async () => {
    photoService = jasmine.createSpyObj<PhotoService>('PhotoService', [
      'uploadPhotos',
      'uploadPhotoWithDate',
      'uploadPhotosWithDates'
    ]);
    photoService.uploadPhotos.and.returnValue(of([]));
    photoService.uploadPhotoWithDate.and.returnValue(of({ photo: {
      id: '', originalName: '', storedPath: '', fileName: '', size: 0, mimeType: '', uploadDate: new Date(), creationDate: new Date()
    } as Photo }));
    photoService.uploadPhotosWithDates.and.returnValue(of({ photos: [] }));

    await TestBed.configureTestingModule({
      imports: [PhotoUploadComponent],
      providers: [{ provide: PhotoService, useValue: photoService }]
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('refuse un upload sans fichier', () => {
    component.uploadFiles();

    expect(photoService.uploadPhotos).not.toHaveBeenCalled();
    expect(photoService.uploadPhotoWithDate).not.toHaveBeenCalled();
    expect(photoService.uploadPhotosWithDates).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('Sélectionnez au moins une image à téléverser.');
  });

  it('stocke les fichiers sélectionnés avec leurs dates de création', () => {
    component.errorMessage = 'Ancienne erreur';
    component.successMessage = 'Ancien succès';
    
    const creationDate = new Date('2026-01-15T10:30:00Z');
    const timestamp = creationDate.getTime();
    const file = new File(['contenu'], 'photo.jpg', { 
      type: 'image/jpeg',
      lastModified: timestamp
    });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    component.onFileSelected({ target: input } as unknown as Event);

    expect(component.selectedFiles).toEqual([file]);
    expect(component.selectedFilesWithDates).toEqual([
      { file, creationDate }
    ]);
    expect(component.errorMessage).toBe('');
    expect(component.successMessage).toBe('');
  });

  it('stocke les fichiers sans date de création si lastModified est 0', () => {
    const file = new File(['contenu'], 'photo.jpg', { 
      type: 'image/jpeg',
      lastModified: 0
    });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    component.onFileSelected({ target: input } as unknown as Event);

    expect(component.selectedFiles).toEqual([file]);
    expect(component.selectedFilesWithDates).toEqual([
      { file, creationDate: null }
    ]);
  });

  it('téléverse une seule photo avec date en appelant uploadPhotoWithDate', () => {
    const creationDate = new Date('2026-01-15T10:30:00Z');
    const file = new File(['contenu'], 'photo.jpg', { 
      type: 'image/jpeg',
      lastModified: creationDate.getTime()
    });
    component.selectedFiles = [file];
    component.selectedFilesWithDates = [{ file, creationDate }];

    component.uploadFiles();

    expect(photoService.uploadPhotoWithDate).toHaveBeenCalledWith(file, creationDate);
    expect(photoService.uploadPhotos).not.toHaveBeenCalled();
    expect(photoService.uploadPhotosWithDates).not.toHaveBeenCalled();
    expect(component.uploading).toBeFalse();
    expect(component.selectedFiles).toEqual([]);
    expect(component.selectedFilesWithDates).toEqual([]);
    expect(component.successMessage).toContain('succès');
  });

  it('téléverse plusieurs photos avec dates en appelant uploadPhotosWithDates', () => {
    const date1 = new Date('2026-01-15T10:30:00Z');
    const date2 = new Date('2026-01-16T11:45:00Z');
    const file1 = new File(['contenu1'], 'photo1.jpg', { 
      type: 'image/jpeg',
      lastModified: date1.getTime()
    });
    const file2 = new File(['contenu2'], 'photo2.jpg', { 
      type: 'image/jpeg',
      lastModified: date2.getTime()
    });
    component.selectedFiles = [file1, file2];
    component.selectedFilesWithDates = [
      { file: file1, creationDate: date1 },
      { file: file2, creationDate: date2 }
    ];

    component.uploadFiles();

    expect(photoService.uploadPhotosWithDates).toHaveBeenCalledWith([file1, file2], [date1, date2]);
    expect(photoService.uploadPhotos).not.toHaveBeenCalled();
    expect(photoService.uploadPhotoWithDate).not.toHaveBeenCalled();
    expect(component.uploading).toBeFalse();
    expect(component.selectedFiles).toEqual([]);
    expect(component.selectedFilesWithDates).toEqual([]);
    expect(component.successMessage).toContain('succès');
  });

  it('utilise le fallback uploadPhotos si aucune date de création n\'est disponible', () => {
    const file = new File(['contenu'], 'photo.jpg', { 
      type: 'image/jpeg',
      lastModified: 0
    });
    component.selectedFiles = [file];
    component.selectedFilesWithDates = [{ file, creationDate: null }];

    component.uploadFiles();

    expect(photoService.uploadPhotos).toHaveBeenCalledWith([file]);
    expect(photoService.uploadPhotoWithDate).not.toHaveBeenCalled();
    expect(photoService.uploadPhotosWithDates).not.toHaveBeenCalled();
    expect(component.uploading).toBeFalse();
    expect(component.selectedFiles).toEqual([]);
    expect(component.selectedFilesWithDates).toEqual([]);
    expect(component.successMessage).toContain('succès');
  });

  it('utilise le fallback uploadPhotos si au moins une photo n\'a pas de date', () => {
    const date = new Date('2026-01-15T10:30:00Z');
    const file1 = new File(['contenu1'], 'photo1.jpg', { 
      type: 'image/jpeg',
      lastModified: date.getTime()
    });
    const file2 = new File(['contenu2'], 'photo2.jpg', { 
      type: 'image/jpeg',
      lastModified: 0
    });
    component.selectedFiles = [file1, file2];
    component.selectedFilesWithDates = [
      { file: file1, creationDate: date },
      { file: file2, creationDate: null }
    ];

    component.uploadFiles();

    expect(photoService.uploadPhotos).toHaveBeenCalledWith([file1, file2]);
    expect(photoService.uploadPhotosWithDates).not.toHaveBeenCalled();
    expect(component.uploading).toBeFalse();
  });

  it('affiche l’erreur pour uploadPhotoWithDate en cas d’échec', () => {
    photoService.uploadPhotoWithDate.and.returnValue(
      throwError(() => new Error('Erreur upload photo unique'))
    );
    
    const creationDate = new Date('2026-01-15T10:30:00Z');
    const file = new File(['contenu'], 'photo.jpg', { 
      type: 'image/jpeg',
      lastModified: creationDate.getTime()
    });
    component.selectedFiles = [file];
    component.selectedFilesWithDates = [{ file, creationDate }];

    component.uploadFiles();

    expect(component.uploading).toBeFalse();
    expect(component.errorMessage).toBe('Erreur upload photo unique');
  });

  it('affiche l’erreur pour uploadPhotosWithDates en cas d’échec', () => {
    photoService.uploadPhotosWithDates.and.returnValue(
      throwError(() => new Error('Erreur upload photos multiples'))
    );
    
    const date1 = new Date('2026-01-15T10:30:00Z');
    const date2 = new Date('2026-01-16T11:45:00Z');
    const file1 = new File(['contenu1'], 'photo1.jpg', { 
      type: 'image/jpeg',
      lastModified: date1.getTime()
    });
    const file2 = new File(['contenu2'], 'photo2.jpg', { 
      type: 'image/jpeg',
      lastModified: date2.getTime()
    });
    component.selectedFiles = [file1, file2];
    component.selectedFilesWithDates = [
      { file: file1, creationDate: date1 },
      { file: file2, creationDate: date2 }
    ];

    component.uploadFiles();

    expect(component.uploading).toBeFalse();
    expect(component.errorMessage).toBe('Erreur upload photos multiples');
  });
});
