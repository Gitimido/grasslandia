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

// UI theme options (what we display to users)
export type ThemeOption = 'light' | 'dark' | 'night-blue' | 'green-grass';

// Database theme options (what we store in the database)
export type DbThemeOption = 'light' | 'dark' | 'blue' | 'green' | 'purple';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private renderer: Renderer2;
  private currentThemeSubject = new BehaviorSubject<ThemeOption>('light');

  // Mapping between UI theme names and database theme names
  private uiToDbThemeMap: Record<ThemeOption, DbThemeOption> = {
    light: 'light',
    dark: 'dark',
    'night-blue': 'blue',
    'green-grass': 'green',
  };

  // Mapping from database theme names to UI theme names
  private dbToUiThemeMap: Record<DbThemeOption, ThemeOption> = {
    light: 'light',
    dark: 'dark',
    blue: 'night-blue',
    green: 'green-grass',
    purple: 'light', // Default fallback for any unused DB values
  };

  get currentTheme$(): Observable<ThemeOption> {
    return this.currentThemeSubject.asObservable();
  }

  // Get the database theme value for a UI theme
  getDbThemeValue(uiTheme: ThemeOption): DbThemeOption {
    return this.uiToDbThemeMap[uiTheme] || 'light';
  }

  // Get the UI theme value for a database theme
  getUiThemeValue(dbTheme: DbThemeOption): ThemeOption {
    return this.dbToUiThemeMap[dbTheme] || 'light';
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
    this.userService.getUserById(userId).subscribe({
      next: (user) => {
        if (user && user.theme) {
          // Convert DB theme to UI theme
          const dbTheme = user.theme as DbThemeOption;
          const uiTheme = this.getUiThemeValue(dbTheme);
          this.setTheme(uiTheme);
        }
      },
      error: (error) => {
        console.error('Error loading user theme:', error);
      },
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
      'theme-night-blue',
      'theme-green-grass',
      // Include legacy class names too for backward compatibility
      'theme-blue',
      'theme-green',
      'theme-purple',
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
        root.style.setProperty('--border-color', '#dddfe2');
        root.style.setProperty('--hover-color', '#f5f7fa');
        root.style.setProperty('--accent-color', '#4a90e2');
        root.style.setProperty('--success-color', '#42b72a');
        root.style.setProperty('--error-color', '#e41e3f');
        root.style.setProperty('--shadow', '0 2px 8px rgba(0, 0, 0, 0.1)');
        break;

      case 'dark':
        root.style.setProperty('--background-color', '#18191a');
        root.style.setProperty('--text-color', '#e4e6eb');
        root.style.setProperty('--card-background', '#242526');
        root.style.setProperty('--primary-color', '#2d88ff');
        root.style.setProperty('--secondary-color', '#3a3b3c');
        root.style.setProperty('--border-color', '#3e4042');
        root.style.setProperty('--hover-color', '#303132');
        root.style.setProperty('--accent-color', '#4a90e2');
        root.style.setProperty('--success-color', '#42b72a');
        root.style.setProperty('--error-color', '#e41e3f');
        root.style.setProperty('--shadow', '0 2px 8px rgba(0, 0, 0, 0.3)');
        break;

      case 'night-blue':
        root.style.setProperty('--background-color', '#1a2a3a');
        root.style.setProperty('--text-color', '#ffffff');
        root.style.setProperty('--card-background', '#2c3e50');
        root.style.setProperty('--primary-color', '#3498db');
        root.style.setProperty('--secondary-color', '#34495e');
        root.style.setProperty('--border-color', '#435b71');
        root.style.setProperty('--hover-color', '#2d4256');
        root.style.setProperty('--accent-color', '#5dade2');
        root.style.setProperty('--success-color', '#2ecc71');
        root.style.setProperty('--error-color', '#e74c3c');
        root.style.setProperty('--shadow', '0 2px 8px rgba(0, 0, 0, 0.4)');
        break;

      case 'green-grass':
        root.style.setProperty('--background-color', '#e8f5e9');
        root.style.setProperty('--text-color', '#2e7d32');
        root.style.setProperty('--card-background', '#ffffff');
        root.style.setProperty('--primary-color', '#4caf50');
        root.style.setProperty('--secondary-color', '#c8e6c9');
        root.style.setProperty('--border-color', '#a5d6a7');
        root.style.setProperty('--hover-color', '#f1f8f1');
        root.style.setProperty('--accent-color', '#66bb6a');
        root.style.setProperty('--success-color', '#43a047');
        root.style.setProperty('--error-color', '#e53935');
        root.style.setProperty('--shadow', '0 2px 8px rgba(0, 0, 0, 0.1)');
        break;
    }
  }
}
