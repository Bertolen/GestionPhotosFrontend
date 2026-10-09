import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PhotoGalleryComponent } from './photo-gallery.component';
import { PhotoService } from '../../shared/services/photo.service';
import { Photo } from '../../shared/models/photo.model';

describe('PhotoGalleryComponent', () => {
  let fixture: ComponentFixture<PhotoGalleryComponent>;
  let component: PhotoGalleryComponent;
  let photoService: jasmine.SpyObj<PhotoService>;

  const photos: Photo[] = [
    {
      id: 'photo-1',
      originalName: 'photo-1.jpg',
      storedPath: '/photos/photo-1.jpg',
      fileName: 'photo-1.jpg',
      size: 100,
      mimeType: 'image/jpeg',
      uploadDate: new Date('2026-09-22T10:00:00'),
      creationDate: new Date('2026-09-20T10:00:00')
    },
    {
      id: 'photo-2',
      originalName: 'photo-2.jpg',
      storedPath: '/photos/photo-2.jpg',
      fileName: 'photo-2.jpg',
      size: 200,
      mimeType: 'image/jpeg',
      uploadDate: new Date('2026-09-22T11:00:00'),
      creationDate: new Date('2026-09-21T11:00:00')
    }
  ];

  beforeEach(async () => {
    photoService = jasmine.createSpyObj<PhotoService>('PhotoService', [
      'getAllPhotos',
      'getPhotosByDateRange',
      'getPhotoUrl',
      'downloadPhoto',
      'downloadPhotosBulk',
      'deletePhotos'
    ]);
    photoService.getAllPhotos.and.returnValue(of(photos));
    photoService.getPhotosByDateRange.and.returnValue(of(photos));
    photoService.getPhotoUrl.and.returnValue(
      'http://localhost:8080/api/photos/photo-1/download'
    );
    photoService.downloadPhoto.and.returnValue(of(new Blob(['photo'])));
    photoService.downloadPhotosBulk.and.returnValue(of(new Blob(['zip'])));
    photoService.deletePhotos.and.returnValue(of(new Map<string, object>()));

    await TestBed.configureTestingModule({
      imports: [PhotoGalleryComponent],
      providers: [{ provide: PhotoService, useValue: photoService }]
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoGalleryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('charge les photos a l initialisation', () => {
    expect(photoService.getAllPhotos).toHaveBeenCalled();
    expect(component.photos).toEqual(photos);
    expect(component.loading).toBeFalse();
  });

  it('utilise PhotoService pour construire l URL de la photo', () => {
    expect(component.getPhotoUrl('photo-1')).toBe(
      'http://localhost:8080/api/photos/photo-1/download'
    );
    expect(photoService.getPhotoUrl).toHaveBeenCalledWith('photo-1');
  });

  it('selectionne et deselectionne une photo au clic', () => {
    component.togglePhotoSelection('photo-1');
    expect(component.selectedPhotoIds.has('photo-1')).toBeTrue();

    component.togglePhotoSelection('photo-1');
    expect(component.selectedPhotoIds.has('photo-1')).toBeFalse();
  });

  it('selectionne toutes les photos affichees puis les deselectionne', () => {
    component.toggleSelectAll();
    expect(component.areAllPhotosSelected()).toBeTrue();
    expect(component.selectedPhotoIds.size).toBe(2);

    component.toggleSelectAll();
    expect(component.selectedPhotoIds.size).toBe(0);
  });

  it('appelle le filtre avec les bornes de debut et de fin', () => {
    component.pendingFromDate = '2026-09-01';
    component.pendingToDate = '2026-09-30';

    component.applyDateFilter();

    expect(photoService.getPhotosByDateRange).toHaveBeenCalledWith(
      '2026-09-01T00:00:00',
      '2026-09-30T23:59:59'
    );
    expect(component.dateFilterOpen).toBeFalse();
  });

  it('refuse une plage dont la date de debut est posterieure a la date de fin', () => {
    component.pendingFromDate = '2026-09-30';
    component.pendingToDate = '2026-09-01';

    component.applyDateFilter();

    expect(photoService.getPhotosByDateRange).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('antérieure ou égale');
  });

  it('ouvre la confirmation et utilise le ZIP par defaut pour plusieurs photos', () => {
    component.selectedPhotoIds = new Set(['photo-1', 'photo-2']);

    component.openDownloadConfirmation();
    expect(component.downloadConfirmationOpen).toBeTrue();
    expect(component.downloadIndividually).toBeFalse();

    component.confirmDownload();

    expect(photoService.downloadPhotosBulk).toHaveBeenCalledWith(['photo-1', 'photo-2']);
    expect(photoService.downloadPhoto).not.toHaveBeenCalled();
  });

  it('telecharge individuellement lorsque l option est cochee', () => {
    component.selectedPhotoIds = new Set(['photo-1', 'photo-2']);
    component.downloadIndividually = true;

    component.confirmDownload();

    expect(photoService.downloadPhoto).toHaveBeenCalledTimes(2);
    expect(photoService.downloadPhoto).toHaveBeenCalledWith('photo-1');
    expect(photoService.downloadPhoto).toHaveBeenCalledWith('photo-2');
    expect(photoService.downloadPhotosBulk).not.toHaveBeenCalled();
  });

  it('affiche une erreur lorsque le chargement echoue', () => {
    photoService.getAllPhotos.and.returnValue(
      throwError(() => new Error('Erreur de test'))
    );

    component.loadPhotos();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('Erreur de test');
  });

  it('ouvre la modale de confirmation de suppression', () => {
    component.selectedPhotoIds = new Set(['photo-1', 'photo-2']);
    component.openDeleteConfirmation();
    expect(component.deleteConfirmationOpen).toBeTrue();
  });

  it('ne pas ouvrir la modale de suppression si aucune photo nest selectionnee', () => {
    component.selectedPhotoIds = new Set();
    component.openDeleteConfirmation();
    expect(component.deleteConfirmationOpen).toBeFalse();
  });

  it('annule la suppression', () => {
    component.deleteConfirmationOpen = true;
    component.cancelDelete();
    expect(component.deleteConfirmationOpen).toBeFalse();
  });

  it('supprime les photos selectionnees et recharge la galerie', () => {
    component.selectedPhotoIds = new Set(['photo-1', 'photo-2']);
    component.confirmDelete();

    expect(photoService.deletePhotos).toHaveBeenCalledWith(['photo-1', 'photo-2']);
    expect(component.deleting).toBeFalse();
    expect(component.selectedPhotoIds.size).toBe(0);
    expect(component.photos).toEqual(photos);
  });

  it('affiche une erreur lorsque la suppression echoue', () => {
    photoService.deletePhotos.and.returnValue(
      throwError(() => new Error('Erreur de suppression'))
    );

    component.selectedPhotoIds = new Set(['photo-1']);
    component.confirmDelete();

    expect(component.deleting).toBeFalse();
    expect(component.errorMessage).toBe('Erreur de suppression');
  });
});
