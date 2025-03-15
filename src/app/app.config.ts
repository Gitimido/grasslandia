// src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { userDataReducer } from './core/store/UserData/user-data.reducer';
import { authReducer } from './core/store/Auth/auth.reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideStore({
      userData: userDataReducer,
      auth: authReducer,
    }),
    provideStoreDevtools({
      maxAge: 25,
      connectInZone: true,
    }),
  ],
};
