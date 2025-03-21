// src/app/components/settings-modal/account-settings/account-settings.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { User } from '../../../models';
import { AuthService } from '../../../core/services/auth.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './account-settings.component.html',
  styleUrls: ['./account-settings.component.scss'],
})
export class AccountSettingsComponent {
  @Input() user: User | null = null;

  deleteAccountForm: FormGroup;
  showDeleteConfirmation = false;
  isDeleting = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.deleteAccountForm = this.fb.group({
      confirmation: ['', [Validators.required, Validators.pattern('DELETE')]],
    });
  }

  toggleDeleteConfirmation(): void {
    this.showDeleteConfirmation = !this.showDeleteConfirmation;
    if (!this.showDeleteConfirmation) {
      this.deleteAccountForm.reset();
      this.errorMessage = '';
    }
  }

  onDeleteAccount(): void {
    if (this.deleteAccountForm.invalid || !this.user) {
      return;
    }

    this.isDeleting = true;
    this.errorMessage = '';

    // Call the API to delete the account
    this.deleteUserAccount()
      .pipe(finalize(() => (this.isDeleting = false)))
      .subscribe({
        next: () => {
          // Sign out and redirect to home
          this.authService.signOut().subscribe(() => {
            this.router.navigate(['/']);
          });
        },
        error: (error) => {
          console.error('Error deleting account:', error);
          this.errorMessage = 'Failed to delete account. Please try again.';
        },
      });
  }

  // This would connect to a real API endpoint to delete the account
  private deleteUserAccount() {
    // Implementation would depend on your backend API
    // For now, we'll simulate a successful deletion
    return this.authService.deleteAccount();
  }
}
