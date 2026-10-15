import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { Problem, Role } from './models';

/** Sends unauthenticated users back to login (except for the session probe itself). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.endsWith('/api/auth/me') && !req.url.endsWith('/api/auth/login')) {
        auth.clear();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.ensureLoaded()) ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export function roleGuard(...roles: Role[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ensureLoaded();
    return auth.hasRole(...roles) ? true : router.createUrlTree(['/dashboard']);
  };
}

/** Turns an API error into one readable sentence for toasts and inline alerts. */
export function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const problem = error.error as Problem | null;
    if (problem?.errors) {
      return Object.values(problem.errors).flat().join(' ');
    }
    if (problem?.detail) {
      return problem.detail;
    }
    if (error.status === 0) {
      return 'Cannot reach the server. Check that the API is running.';
    }
    if (error.status === 403) {
      return 'Your role is not allowed to do that.';
    }
    return problem?.title ?? `Request failed (${error.status}).`;
  }
  return 'Something went wrong.';
}

/** Field-level validation messages keyed by camelCase property name. */
export function fieldErrors(error: unknown): Record<string, string[]> {
  return error instanceof HttpErrorResponse ? ((error.error as Problem | null)?.errors ?? {}) : {};
}
