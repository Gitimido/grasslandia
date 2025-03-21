// src/app/core/services/theme.service.ts
import {
  Injectable,
  Renderer2,
  RendererFactory2,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserService } from './user.service';
import { AuthService } from './auth.service';

export type ThemeOption = 'light' | 'dark' | 'blue' | 'purple' | 'green';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private renderer: Renderer2;
  private currentThemeSubject = new BehaviorSubject<ThemeOption>('light');

  get currentTheme$(): Observable<ThemeOption> {
    return this.currentThemeSubject.asObservable();
  }

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object,
    private userService: UserService,
    private authService: AuthService
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);

    // Initialize theme from localStorage or default to light
    this.initializeTheme();

    // Subscribe to auth changes to update theme based on user preferences
    this.authService.user$.subscribe((user) => {
      if (user) {
        this.loadUserTheme(user.id);
      }
    });
  }

  private initializeTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('theme') as ThemeOption;
      const theme = savedTheme || 'light';
      this.setTheme(theme);
    }
  }

  private loadUserTheme(userId: string): void {
    this.userService.getUserById(userId).subscribe((user) => {
      if (user && user.theme) {
        this.setTheme(user.theme);
      }
    });
  }

  setTheme(theme: ThemeOption): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Store in localStorage
    localStorage.setItem('theme', theme);

    // Remove all existing theme classes
    this.removeAllThemeClasses();

    // Add the new theme class to the body
    this.renderer.addClass(this.document.body, `theme-${theme}`);

    // Update CSS variables based on the theme
    this.updateThemeVariables(theme);

    // Update the BehaviorSubject
    this.currentThemeSubject.next(theme);
  }

  private removeAllThemeClasses(): void {
    const themeClasses = [
      'theme-light',
      'theme-dark',
      'theme-blue',
      'theme-purple',
      'theme-green',
    ];
    themeClasses.forEach((cls) => {
      this.renderer.removeClass(this.document.body, cls);
    });
  }

  private updateThemeVariables(theme: ThemeOption): void {
    const root = this.document.documentElement;

    switch (theme) {
      case 'light':
        root.style.setProperty('--background-color', '#f0f2f5');
        root.style.setProperty('--text-color', '#1c1e21');
        root.style.setProperty('--card-background', '#ffffff');
        root.style.setProperty('--primary-color', '#1877f2');
        root.style.setProperty('--secondary-color', '#e4e6eb');
        break;

      case 'dark':
        root.style.setProperty('--background-color', '#18191a');
        root.style.setProperty('--text-color', '#e4e6eb');
        root.style.setProperty('--card-background', '#242526');
        root.style.setProperty('--primary-color', '#2d88ff');
        root.style.setProperty('--secondary-color', '#3a3b3c');
        break;

      case 'blue':
        root.style.setProperty('--background-color', '#1a2a3a');
        root.style.setProperty('--text-color', '#ffffff');
        root.style.setProperty('--card-background', '#2c3e50');
        root.style.setProperty('--primary-color', '#3498db');
        root.style.setProperty('--secondary-color', '#34495e');
        break;

      case 'purple':
        root.style.setProperty('--background-color', '#2c2c54');
        root.style.setProperty('--text-color', '#f5f6fa');
        root.style.setProperty('--card-background', '#40407a');
        root.style.setProperty('--primary-color', '#8a52e6');
        root.style.setProperty('--secondary-color', '#474787');
        break;

      case 'green':
        root.style.setProperty('--background-color', '#e8f5e9');
        root.style.setProperty('--text-color', '#2e7d32');
        root.style.setProperty('--card-background', '#ffffff');
        root.style.setProperty('--primary-color', '#4caf50');
        root.style.setProperty('--secondary-color', '#c8e6c9');
        break;
    }
  }
}
