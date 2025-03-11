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
    path: 'profile/:username',
    component: ProfileComponent,
  },
  {
    path: 'profile',
    redirectTo: '/profile/me',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
