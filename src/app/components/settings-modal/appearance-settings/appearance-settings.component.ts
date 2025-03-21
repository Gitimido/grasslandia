// src/app/components/settings-modal/appearance-settings/appearance-settings.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../../models';
import { ThemeService } from '../../../core/services/theme.service';
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
    { value: 'light' as const, label: 'Light', color: '#ffffff' },
    { value: 'dark' as const, label: 'Dark', color: '#1c1e21' },
    { value: 'blue' as const, label: 'Blue', color: '#1877f2' },
    { value: 'purple' as const, label: 'Purple', color: '#8a52e6' },
    { value: 'green' as const, label: 'Green', color: '#42b72a' },
  ];

  currentTheme: 'light' | 'dark' | 'blue' | 'purple' | 'green' = 'light';
  displayMode: 'default' | 'compact' = 'default';

  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  constructor(
    private themeService: ThemeService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    if (this.user) {
      this.currentTheme = this.user.theme;
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

  setTheme(theme: 'light' | 'dark' | 'blue' | 'purple' | 'green'): void {
    if (!this.user || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.currentTheme = theme;

    const userData = {
      theme: theme,
    };

    this.userService
      .updateUserProfile(this.user.id, userData)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (updatedUser) => {
          if (updatedUser) {
            // Apply the theme
            this.themeService.setTheme(theme);

            // Update the local user object
            if (this.user) {
              this.user.theme = theme;
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
