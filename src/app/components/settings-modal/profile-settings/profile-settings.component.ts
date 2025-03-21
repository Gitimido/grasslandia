// src/app/components/settings-modal/profile-settings/profile-settings.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { User } from '../../../models';
import { UserService } from '../../../core/services/user.service';
import { ProfilePictureUploaderComponent } from '../../../components/profile-picture-uploader/profile-picture-uploader.component';
import { Media } from '../../../models';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProfilePictureUploaderComponent,
  ],
  templateUrl: './profile-settings.component.html',
  styleUrls: ['./profile-settings.component.scss'],
})
export class ProfileSettingsComponent implements OnInit {
  @Input() user: User | null = null;

  profileForm: FormGroup;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  constructor(private fb: FormBuilder, private userService: UserService) {
    this.profileForm = this.fb.group({
      fullName: ['', Validators.required],
      username: ['', [Validators.required, Validators.minLength(3)]],
      bio: [''],
    });
  }

  ngOnInit(): void {
    if (this.user) {
      this.profileForm.patchValue({
        fullName: this.user.fullName || '',
        username: this.user.username || '',
        bio: this.user.bio || '',
      });
    }
  }

  onProfilePictureChanged(media: Media | null): void {
    if (!this.user) return;

    const avatarUrl = media?.url || null;

    // Update UI immediately
    if (this.user) {
      this.user.avatarUrl = avatarUrl ?? undefined;
    }

    // Update in database
    this.userService
      .updateUserProfilePicture(this.user.id, avatarUrl)
      .subscribe({
        next: (updatedUser) => {
          if (updatedUser) {
            this.successMessage = 'Profile picture updated successfully';
            setTimeout(() => {
              this.successMessage = '';
            }, 3000);
          }
        },
        error: (error) => {
          console.error('Error updating profile picture:', error);
          this.errorMessage = 'Failed to update profile picture';
          setTimeout(() => {
            this.errorMessage = '';
          }, 3000);
        },
      });
  }

  onSubmit(): void {
    if (this.profileForm.invalid || !this.user) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const userData = {
      fullName: this.profileForm.value.fullName,
      username: this.profileForm.value.username,
      bio: this.profileForm.value.bio,
    };

    this.userService
      .updateUserProfile(this.user.id, userData)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (updatedUser) => {
          if (updatedUser && this.user) {
            // Update the local user object - fixed by checking for null
            this.user.fullName = updatedUser.fullName;
            this.user.username = updatedUser.username;
            this.user.bio = updatedUser.bio;

            this.successMessage = 'Profile updated successfully';
            setTimeout(() => {
              this.successMessage = '';
            }, 3000);
          }
        },
        error: (error) => {
          console.error('Error updating profile:', error);
          this.errorMessage = 'Failed to update profile';
        },
      });
  }
}
