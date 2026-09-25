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
});
