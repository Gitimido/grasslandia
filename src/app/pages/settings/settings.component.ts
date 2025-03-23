// src/app/pages/settings/settings.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { User } from '../../models/user.model';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { SettingsModalComponent } from '../../components/settings-modal/settings-modal.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, SettingsModalComponent],
  template: `
    <app-settings-modal [user]="currentUser" (close)="onCloseSettings()">
    </app-settings-modal>
  `,
  styles: [],
})
export class SettingsComponent implements OnInit {
  currentUser: User | null = null;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if user is authenticated
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/signin']);
      return;
    }

    // Load user profile
    this.userService.getCurrentUserProfile().subscribe({
      next: (user) => {
        this.currentUser = user;
      },
      error: (error) => {
        console.error('Error loading user profile:', error);
        this.router.navigate(['/']);
      },
    });
  }

  onCloseSettings(): void {
    // Navigate back to home or previous page
    this.router.navigate(['/']);
  }
}
