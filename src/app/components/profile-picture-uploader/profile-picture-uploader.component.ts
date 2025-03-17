import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaService } from '../../core/services/media.service';
import { AuthService } from '../../core/services/auth.service';
import { Media } from '../../models';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-profile-picture-uploader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="profile-picture-uploader">
      <div class="profile-avatar" [class.has-image]="currentImageUrl">
        <img
          [src]="currentImageUrl || '/assets/default-avatar.png'"
          alt="Profile picture"
        />

        <div class="overlay">
          <label class="upload-button" [class.uploading]="isUploading">
            <span *ngIf="!isUploading">{{
              currentImageUrl ? 'Change' : 'Upload'
            }}</span>
            <span *ngIf="isUploading" class="spinner"></span>
            <input
              type="file"
              (change)="onFileSelected($event)"
              accept="image/*"
              [disabled]="isUploading"
            />
          </label>

          <button
            *ngIf="currentImageUrl && !isUploading"
            class="remove-button"
            (click)="removeProfilePicture()"
          >
            Remove
          </button>
        </div>
      </div>

      <div *ngIf="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>
  `,
  styles: [
    `
      .profile-picture-uploader {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .profile-avatar {
        position: relative;
        width: 150px;
        height: 150px;
        border-radius: 50%;
        overflow: hidden;
        background-color: #f0f0f0;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          opacity: 0;
          transition: opacity 0.3s;
        }

        &:hover .overlay {
          opacity: 1;
        }

        &.has-image .overlay {
          background: rgba(0, 0, 0, 0.7);
        }
      }

      .upload-button {
        padding: 8px 16px;
        background-color: #4a90e2;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-bottom: 8px;

        input {
          display: none;
        }

        &.uploading {
          background-color: #3a7bc8;
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
      }

      .remove-button {
        padding: 6px 12px;
        background-color: #e74c3c;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }

      .error-message {
        margin-top: 12px;
        color: #e74c3c;
        font-size: 14px;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class ProfilePictureUploaderComponent {
  @Output() pictureChanged = new EventEmitter<Media | null>();

  currentImageUrl: string | null = null;
  isUploading = false;
  errorMessage: string | null = null;

  constructor(
    private mediaService: MediaService,
    private authService: AuthService
  ) {
    // Try to load current profile picture
    this.loadCurrentProfilePicture();
  }

  loadCurrentProfilePicture(): void {
    const userId = this.authService.user?.id;
    if (!userId) return;

    this.mediaService.getUserProfileMedia(userId).subscribe((media) => {
      if (media) {
        this.currentImageUrl = media.url;
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please select an image file.';
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Image size should be less than 5MB.';
      return;
    }

    this.uploadProfilePicture(file);
  }

  uploadProfilePicture(file: File): void {
    this.isUploading = true;
    this.errorMessage = null;

    this.mediaService
      .uploadProfilePicture(file)
      .pipe(finalize(() => (this.isUploading = false)))
      .subscribe({
        next: (media) => {
          this.currentImageUrl = media.url;
          this.pictureChanged.emit(media);
        },
        error: (error) => {
          console.error('Error uploading profile picture:', error);
          this.errorMessage =
            'Failed to upload profile picture. Please try again.';
        },
      });
  }

  removeProfilePicture(): void {
    this.currentImageUrl = null;
    this.pictureChanged.emit(null);
  }
}
