import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

function clearSession(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('restaurant_token');
    localStorage.removeItem('auth_token_expires_at');
    localStorage.removeItem('restaurant_session');
    localStorage.removeItem('restaurant_login_at');
    localStorage.removeItem('user_data');
}

function isExpired(): boolean {
    const expiresAt = localStorage.getItem('auth_token_expires_at');
    return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

function isPublicAuthRequest(url: string): boolean {
    return [
        '/saas/login',
        '/saas/google/login',
        '/saas/signup',
        '/auth/login',
        '/auth/verify-otp',
        '/admin/auth/login',
        '/admin/auth/verify-otp',
        '/otp/request',
        '/public/',
    ].some((path) => url.includes(path));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const skipAuthHandling = isPublicAuthRequest(req.url);
    const token = localStorage.getItem('auth_token') || localStorage.getItem('restaurant_token');

    if (!skipAuthHandling && token && isExpired()) {
        clearSession();
        window.location.href = '/restaurant/login';
        return throwError(() => new Error('Session expired'));
    }

    if (token && !skipAuthHandling) {
        const cloned = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
        return next(cloned).pipe(catchError((error: HttpErrorResponse) => {
            if (error.status === 401 || error.status === 419) {
                clearSession();
                window.location.href = '/restaurant/login';
            }

            return throwError(() => error);
        }));
    }

    return next(req);
};
