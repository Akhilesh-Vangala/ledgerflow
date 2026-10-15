import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { authInterceptor, describeError, fieldErrors } from './http';

const problem = (status: number, body: object | null) => new HttpErrorResponse({ status, error: body });

describe('describeError', () => {
  it('joins validation messages', () => {
    const error = problem(400, { status: 400, title: 'Validation failed', errors: { lines: ['Add at least one line.'], taxId: ['Bad tax id.'] } });
    expect(describeError(error)).toBe('Add at least one line. Bad tax id.');
  });

  it('prefers the problem detail for business rule conflicts', () => {
    const error = problem(409, { status: 409, title: 'Business rule violated', detail: 'Invoices above $10,000 require a controller.' });
    expect(describeError(error)).toBe('Invoices above $10,000 require a controller.');
  });

  it('explains network failures and forbidden roles', () => {
    expect(describeError(problem(0, null))).toContain('Cannot reach the server');
    expect(describeError(problem(403, null))).toBe('Your role is not allowed to do that.');
  });

  it('falls back for unknown errors', () => {
    expect(describeError(problem(502, null))).toBe('Request failed (502).');
    expect(describeError(new Error('boom'))).toBe('Something went wrong.');
  });
});

describe('fieldErrors', () => {
  it('returns field messages keyed by property', () => {
    expect(fieldErrors(problem(400, { errors: { name: ['Required.'] } }))).toEqual({ name: ['Required.'] });
    expect(fieldErrors(new Error('x'))).toEqual({});
  });
});

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: jasmine.SpyObj<Router>;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/invoices?status=Submitted' });
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['clear']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('sends an expired session back to login with a return url', () => {
    http.get('/api/invoices').subscribe({ error: () => undefined });
    backend.expectOne('/api/invoices').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.clear).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/invoices?status=Submitted' } });
  });

  it('leaves the session probe alone', () => {
    http.get('/api/auth/me').subscribe({ error: () => undefined });
    backend.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not log out on forbidden', () => {
    http.post('/api/payment-runs/1/release', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/payment-runs/1/release').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(auth.clear).not.toHaveBeenCalled();
  });
});
