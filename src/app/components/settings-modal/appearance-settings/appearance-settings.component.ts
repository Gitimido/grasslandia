// src/app/components/settings-modal/appearance-settings/appearance-settings.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../../models';
import {
  ThemeService,
  ThemeOption,
} from '../../../core/services/theme.service';
import { UserService } from '../../../core/services/user.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './appearance-settings.component.html',
  styleUrls: ['./appearance-settings.component.scss'],
})
export class AppearanceSettingsComponent implements OnInit {
  @Input() user: User | null = null;

  availableThemes = [
    {
      value: 'light' as ThemeOption,
      label: 'Light Mode',
      color: '#ffffff',
      icon: 'light_mode',
    },
    {
      value: 'dark' as ThemeOption,
      label: 'Dark Mode',
      color: '#242526',
      icon: 'dark_mode',
    },
    {
      value: 'night-blue' as ThemeOption,
      label: 'Night Blue',
      color: '#2c3e50',
      icon: 'nightlight',
    },
    {
      value: 'green-grass' as ThemeOption,
      label: 'Soft Green ( Good for Eyes )',
      color: '#4caf50',
      icon: 'grass',
    },
  ];

  currentTheme: ThemeOption = 'light';
  displayMode: 'default' | 'compact' = 'default';

  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  constructor(
    private themeService: ThemeService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Get the current theme from the theme service
    this.themeService.currentTheme$.subscribe((theme) => {
      this.currentTheme = theme;
    });

    // Determine current theme from user profile if available
    if (this.user && this.user.theme) {
      // Handle legacy theme names by mapping to new UI themes
      this.currentTheme = this.themeService.getUiThemeValue(this.user.theme);
    }

    // Get the current display mode from localStorage if available
    const savedDisplayMode = localStorage.getItem('displayMode') as
      | 'default'
      | 'compact'
      | null;
    if (savedDisplayMode) {
      this.displayMode = savedDisplayMode;
    }
  }

  setTheme(theme: ThemeOption): void {
    if (!this.user || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.currentTheme = theme;

    // Map UI theme to database theme value
    const dbTheme = this.themeService.getDbThemeValue(theme);

    // Send the database theme value to the server
    const userData = {
      theme: dbTheme,
    };

    this.userService
      .updateUserProfile(this.user.id, userData)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (updatedUser) => {
          if (updatedUser) {
            // Apply the UI theme
            this.themeService.setTheme(theme);

            // Update the local user object with the database theme
            if (this.user) {
              this.user.theme = dbTheme;
            }

            this.successMessage = 'Theme updated successfully';
            setTimeout(() => {
              this.successMessage = '';
            }, 3000);
          }
        },
        error: (error) => {
          console.error('Error updating theme:', error);
          this.errorMessage = 'Failed to update theme';
          setTimeout(() => {
            this.errorMessage = '';
          }, 3000);
        },
      });
  }

  setDisplayMode(mode: 'default' | 'compact'): void {
    this.displayMode = mode;

    // Save to localStorage for persistence
    localStorage.setItem('displayMode', mode);

    // Set CSS class on body
    document.body.classList.remove('display-default', 'display-compact');
    document.body.classList.add(`display-${mode}`);

    this.successMessage = 'Display mode updated successfully';
    setTimeout(() => {
      this.successMessage = '';
    }, 3000);
  }

  // Helper methods
  isThemeActive(theme: string): boolean {
    return this.currentTheme === theme;
  }

  isDisplayModeActive(mode: 'default' | 'compact'): boolean {
    return this.displayMode === mode;
  }
}
