// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { SignInComponent } from './pages/sign-in/sign-in.component';
import { ProfileComponent } from './pages/profile/profile.component';

export const routes: Routes = [
  { path: 'Home', component: HomeComponent },
  { path: 'Login', component: SignInComponent },
  { path: '', redirectTo: 'Home', pathMatch: 'full' },
  {
    path: 'signin',
    loadComponent: () =>
      import('./pages/sign-in/sign-in.component').then(
        (m) => m.SignInComponent
      ),
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./pages/sign-up/sign-up.component').then(
        (m) => m.SignUpComponent
      ),
  },
  {
    path: 'bookmarks',
    loadComponent: () =>
      import('./pages/bookmarks/bookmarks.component').then(
        (m) => m.BookmarksComponent
      ),
  },
  {
    path: 'profile/:username',
    component: ProfileComponent,
  },
  {
    path: 'profile',
    redirectTo: '/profile/me',
    pathMatch: 'full',
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./pages/search-results/search-results.component').then(
        (m) => m.SearchResultsComponent
      ),
  },
  {
    path: 'post/:id',
    loadComponent: () =>
      import('./pages/post-detail/post-detail.component').then(
        (m) => m.PostDetailComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
