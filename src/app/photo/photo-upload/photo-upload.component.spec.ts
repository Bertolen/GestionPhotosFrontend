import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PhotoUploadComponent } from './photo-upload.component';
import { PhotoService } from '../../shared/services/photo.service';

describe('PhotoUploadComponent', () => {
  let fixture: ComponentFixture<PhotoUploadComponent>;
  let component: PhotoUploadComponent;
  let photoService: jasmine.SpyObj<PhotoService>;

  beforeEach(async () => {
    photoService = jasmine.createSpyObj<PhotoService>('PhotoService', ['uploadPhotos']);
    photoService.uploadPhotos.and.returnValue(of([]));

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
    expect(component.errorMessage).toBe('Sélectionnez au moins une image à téléverser.');
  });

  it('stocke les fichiers sélectionnés et réinitialise les messages', () => {
    component.errorMessage = 'Ancienne erreur';
    component.successMessage = 'Ancien succès';
    const file = new File(['contenu'], 'photo.jpg', { type: 'image/jpeg' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    component.onFileSelected({ target: input } as unknown as Event);

    expect(component.selectedFiles).toEqual([file]);
    expect(component.errorMessage).toBe('');
    expect(component.successMessage).toBe('');
  });

  it('téléverse les fichiers et vide la sélection en cas de succès', () => {
    const file = new File(['contenu'], 'photo.jpg', { type: 'image/jpeg' });
    component.selectedFiles = [file];

    component.uploadFiles();

    expect(photoService.uploadPhotos).toHaveBeenCalledWith([file]);
    expect(component.uploading).toBeFalse();
    expect(component.selectedFiles).toEqual([]);
    expect(component.successMessage).toContain('succès');
  });

  it('affiche l’erreur du service en cas d’échec', () => {
    photoService.uploadPhotos.and.returnValue(
      throwError(() => new Error('Upload impossible'))
    );
    component.selectedFiles = [
      new File(['contenu'], 'photo.jpg', { type: 'image/jpeg' })
    ];

    component.uploadFiles();

    expect(component.uploading).toBeFalse();
    expect(component.errorMessage).toBe('Upload impossible');
  });
});
