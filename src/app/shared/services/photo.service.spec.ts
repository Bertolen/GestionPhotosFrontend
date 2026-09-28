import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PhotoService } from './photo.service';

describe('PhotoService', () => {
  let service: PhotoService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PhotoService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(PhotoService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('récupère toutes les photos', () => {
    service.getAllPhotos().subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/photos');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('récupère les photos dans une plage de dates', () => {
    service.getPhotosByDateRange(
      '2026-09-01T00:00:00',
      '2026-09-30T23:59:59'
    ).subscribe();

    const request = httpTesting.expectOne((req) =>
      req.url === 'http://localhost:8080/api/photos/by-date'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('fromDate')).toBe('2026-09-01T00:00:00');
    expect(request.request.params.get('toDate')).toBe('2026-09-30T23:59:59');
    request.flush([]);
  });

  it('télécharge une photo', () => {
    service.downloadPhoto('photo-1').subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/photos/photo-1/download'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['photo']));
  });

  it('télécharge plusieurs photos dans un ZIP', () => {
    service.downloadPhotosBulk(['photo-1', 'photo-2']).subscribe();

    const request = httpTesting.expectOne((req) =>
      req.url === 'http://localhost:8080/api/photos/download/bulk'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.params.getAll('photoIds')).toEqual([
      'photo-1',
      'photo-2'
    ]);
    request.flush(new Blob(['zip']));
  });

  it('traduit une erreur HTTP 404 en erreur métier', () => {
    let errorMessage = '';
    service.getPhotoById('missing').subscribe({
      error: (error: Error) => errorMessage = error.message
    });

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/photos/missing'
    );
    request.flush({}, { status: 404, statusText: 'Not Found' });

    expect(errorMessage).toBe('Ressource non trouvée.');
  });

  it('téléverse une photo avec sa date de création', () => {
    const file = new File(['contenu'], 'photo.jpg', { type: 'image/jpeg' });
    const creationDate = new Date('2026-01-15T10:30:00.000Z');
    
    service.uploadPhotoWithDate(file, creationDate).subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/photos/upload/single-with-date'
    );
    expect(request.request.method).toBe('POST');
    
    // Vérifier que le FormData contient le fichier et la date
    const formData = request.request.body as FormData;
    expect(formData.get('file')).toEqual(file);
    expect(formData.get('creationDate')).toBe('2026-01-15T10:30:00.000Z');
    
    request.flush({ photo: {}, message: 'Upload réussi' });
  });

  it('téléverse plusieurs photos avec leurs dates de création', () => {
    const file1 = new File(['contenu1'], 'photo1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['contenu2'], 'photo2.jpg', { type: 'image/jpeg' });
    const date1 = new Date('2026-01-15T10:30:00.000Z');
    const date2 = new Date('2026-01-16T11:45:00.000Z');
    
    service.uploadPhotosWithDates([file1, file2], [date1, date2]).subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/photos/upload/multiple-with-date'
    );
    expect(request.request.method).toBe('POST');
    
    // Vérifier que le FormData contient les fichiers et les dates
    const formData = request.request.body as FormData;
    const files = formData.getAll('files');
    expect(files).toHaveSize(2);
    expect(files[0]).toEqual(file1);
    expect(files[1]).toEqual(file2);
    
    const creationDates = formData.getAll('creationDates');
    expect(creationDates).toHaveSize(2);
    expect(creationDates[0]).toBe('2026-01-15T10:30:00.000Z');
    expect(creationDates[1]).toBe('2026-01-16T11:45:00.000Z');
    
    request.flush({ photos: [], message: 'Uploads réussis' });
  });
});
