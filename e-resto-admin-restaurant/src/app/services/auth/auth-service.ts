import {inject, Injectable, NgZone} from "@angular/core";
import { HttpClient } from '@angular/common/http';
import {BehaviorSubject, fromEvent, merge, Observable, Subscription, switchMap, tap, timer} from "rxjs";
import {Router} from "@angular/router";
import { API_ROOT } from "../api-url";

@Injectable({
  providedIn: "root",
})
export class AuthService {

  private http = inject(HttpClient);
  private router = inject(Router);
  private ngZone = inject(NgZone); // Pour optimiser les performances

  private userActivitySubscription?: Subscription;
  private readonly TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

  private emailSource = new BehaviorSubject<string>('');
  currentEmail = this.emailSource.asObservable();
  private loggedIn = new BehaviorSubject<boolean>(this.hasToken());

  private apiUrl = API_ROOT;
  constructor() {
    if (this.hasToken()) {
   //   this.initListener();
    }
  }

  private hasToken(): boolean {
    const expiresAt = localStorage.getItem('auth_token_expires_at');
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      this.clearLocalSession();
      return false;
    }

    return !!localStorage.getItem('auth_token');
  }

  isLoggedIn(): Observable<boolean> {
    return this.loggedIn.asObservable();
  }

  login(email:string, password:string):Observable<any>{
    return this.http.post(`${this.apiUrl}/auth/login`, { email, password });
  }

  setEmail(email: string) {
    this.emailSource.next(email);
  }
  private initListener() {
    // On nettoie l'ancienne souscription si elle existe
    this.stopListener();

    // NgZone.runOutsideAngular évite de déclencher le Change Detection à chaque mouvement de souris
    this.ngZone.runOutsideAngular(() => {
      const eventStreams = merge(
          fromEvent(document, 'click'),
          fromEvent(document, 'mousemove'),
          fromEvent(document, 'keydown'),
          fromEvent(document, 'scroll')
      );

      this.userActivitySubscription = eventStreams.pipe(
          // Chaque fois qu'un événement arrive, on redémarre le timer de 15 min
          switchMap(() => timer(this.TIMEOUT_MS))
      ).subscribe(() => {
        // On rentre dans la zone Angular pour exécuter la déconnexion et redirection
        this.ngZone.run(() => {
          this.logout().subscribe(() => {
            this.router.navigate(['/restaurant/login']);
          });
        });
      });
    });
  }

  private stopListener() {
    if (this.userActivitySubscription) {
      this.userActivitySubscription.unsubscribe();
    }
  }
  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/verify-otp`, { email, otp }).pipe(
        tap((response: any) => {
          if (response && response.token) {
            this.saveToken(response.token, response.token_expires_at);
            localStorage.setItem('user_data', JSON.stringify(response.user));
            localStorage.setItem('restaurant_token', response.token);
            localStorage.setItem('restaurant_login_at', new Date().toISOString());
            if (response.restaurant) {
              localStorage.setItem('restaurant_session', JSON.stringify(response.restaurant));
            }
            this.loggedIn.next(true);
          //  this.initListener(); // Démarre le timer après une connexion réussie
          }
        })
    );
  }

  requestOtp(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/otp/request`, { email });
  }

  saveToken(token: string, expiresAt?: string) {
    localStorage.setItem('auth_token', token);
    if (expiresAt) {
      localStorage.setItem('auth_token_expires_at', expiresAt);
    }
  }

  getToken(): string | null {
    const expiresAt = localStorage.getItem('auth_token_expires_at');
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      this.clearLocalSession();
      return null;
    }

    return localStorage.getItem('auth_token');
  }

  getUserData() {
    const data = localStorage.getItem('user_data');
    return data ? JSON.parse(data) : null;
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}).pipe(
        tap(() => {
          this.clearLocalSession();
        }),
        // En cas d'erreur serveur (token déjà expiré), on vide quand même le local
        tap({ error: () => this.clearLocalSession() })
    );
  }

  clearLocalSession() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('restaurant_token');
    localStorage.removeItem('auth_token_expires_at');
    localStorage.removeItem('restaurant_session');
    localStorage.removeItem('restaurant_login_at');
    localStorage.removeItem('user_data');
    this.loggedIn.next(false);
   // this.stopListener(); // Arrête le timer
  }
  changePassword(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/change-password`, data);
  }
}
