// src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

// Existing reducers
import { userDataReducer } from './core/store/UserData/user-data.reducer';
import { authReducer } from './core/store/Auth/auth.reducer';

// New reducers
import { postsReducer } from './core/store/Posts/posts.actions';
import { commentsReducer } from './core/store/Comments/comments.reducer';
import { friendshipReducer } from './core/store/Friendship/friendship.reducer';
import { notificationsReducer } from './core/store/Notifications/notifications.reducer';
import { uiReducer } from './core/store/UI/ui.reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideStore({
      userData: userDataReducer,
      auth: authReducer,
      posts: postsReducer,
      comments: commentsReducer,
      friendship: friendshipReducer,
      notifications: notificationsReducer,
      ui: uiReducer,
    }),
    provideStoreDevtools({
      maxAge: 25,
      connectInZone: true,
    }),
  ],
};
