import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import {provideHttpClient, withInterceptors} from "@angular/common/http";
import {authInterceptor} from "./interceptor/auth/auth.interceptor";
import {provideTranslateService} from "@ngx-translate/core";
import {provideTranslateHttpLoader} from "@ngx-translate/http-loader";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideTranslateService({
      fallbackLang: 'fr',
      lang: localStorage.getItem('app_lang') || 'fr',
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json',
      }) as any,
    }),
    provideRouter(routes, withInMemoryScrolling({
      anchorScrolling: 'enabled',
      scrollPositionRestoration: 'enabled',
    }))
  ]
};


