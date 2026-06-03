import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SaasService } from '../saas/saas-service';

type GoogleCredentialResponse = { credential?: string };

@Injectable({ providedIn: 'root' })
export class GoogleIdentityService {
  private scriptPromise?: Promise<void>;

  constructor(private saas: SaasService) {}

  async renderButton(element: HTMLElement, onCredential: (credential: string) => void): Promise<boolean> {
    const config = await firstValueFrom(this.saas.googleConfig());
    if (!config.enabled || !config.client_id) {
      return false;
    }

    await this.loadScript();
    const google = (window as any).google;
    if (!google?.accounts?.id) {
      return false;
    }

    google.accounts.id.initialize({
      client_id: config.client_id,
      callback: (response: GoogleCredentialResponse) => {
        if (response.credential) {
          onCredential(response.credential);
        }
      },
    });
    element.innerHTML = '';
    google.accounts.id.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      width: Math.min(400, Math.max(280, Math.floor(element.getBoundingClientRect().width))),
      text: 'continue_with',
      locale: 'fr',
    });

    return true;
  }

  private loadScript(): Promise<void> {
    if ((window as any).google?.accounts?.id) {
      return Promise.resolve();
    }

    if (!this.scriptPromise) {
      this.scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Google Identity Services indisponible.'));
        document.head.appendChild(script);
      });
    }

    return this.scriptPromise;
  }
}
