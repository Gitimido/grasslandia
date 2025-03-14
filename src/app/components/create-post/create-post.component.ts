import {
  Component,
  EventEmitter,
  Output,
  OnInit,
  OnDestroy,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalService } from '../../core/services/model.service';
import { PostService } from '../../core/services/post.service';
import { AuthService } from '../../core/services/auth.service';
import { Post } from '../../models';
import { catchError, finalize, of, Subscription } from 'rxjs';

// Define available post types
export enum PostType {
  TEXT = 'text',
  PHOTO = 'photo',
  VIDEO = 'video',
  POLL = 'poll',
}

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-post.component.html',
  styleUrls: ['./create-post.component.scss'],
  // This is important - it allows our styles to affect elements outside component
  encapsulation: ViewEncapsulation.None,
})
export class CreatePostComponent implements OnInit, OnDestroy {
  @Output() postCreated = new EventEmitter<Post>();

  // State variables
  postContent = '';
  selectedFiles: File[] = [];
  isSubmitting = false;
  privacyLevel: 'public' | 'friends' | 'only_me' = 'public';
  error = '';
  showPrivacyOptions = false;
  userAvatar = '';
  userName = '';

  // Post type selection
  postTypes = PostType;
  selectedPostType: PostType = PostType.TEXT;

  // Subscription for modal state changes
  private modalSubscription?: Subscription;

  constructor(
    private postService: PostService,
    private authService: AuthService,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    // Get user info for avatar and name
    if (this.authService.user) {
      // Try to get avatar from user metadata
      this.userAvatar =
        this.authService.user.user_metadata?.['avatar_url'] || '';

      // Try to get user's name
      this.userName =
        this.authService.user.user_metadata?.['full_name'] ||
        this.authService.user.user_metadata?.['username'] ||
        (this.authService.user.email
          ? this.authService.user.email.split('@')[0]
          : 'User');
    }

    // Subscribe to modal state changes
    this.modalSubscription = this.modalService.modalState$.subscribe(
      (isOpen) => {
        // Handle modal state changes if needed
        if (!isOpen) {
          // Modal was closed
          this.handleModalClosed();
        }
      }
    );

    // Add event handlers to document for modal interactions
    this.setupGlobalEventListeners();
  }

  ngOnDestroy(): void {
    // Clean up subscription
    if (this.modalSubscription) {
      this.modalSubscription.unsubscribe();
    }

    // Remove any open modal
    if (this.modalService.isModalOpen()) {
      this.modalService.closeModal();
    }
  }

  // Setup global event listeners for modal interactions
  private setupGlobalEventListeners(): void {
    // Using event delegation on document body
    document.body.addEventListener('click', this.handleGlobalClick);
  }

  // Handler for clicks on dynamically created elements
  private handleGlobalClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Handle close button click
    if (
      target.classList.contains('close-btn') ||
      target.closest('.close-btn')
    ) {
      this.closeModal();
      event.stopPropagation();
      return;
    }

    // Handle overlay click for closing
    if (
      target.classList.contains('post-modal-overlay') &&
      !target.closest('.post-modal')
    ) {
      this.closeModal();
      event.stopPropagation();
      return;
    }

    // Handle privacy option selections
    if (
      target.classList.contains('option-item') ||
      target.closest('.option-item')
    ) {
      const optionEl = target.classList.contains('option-item')
        ? target
        : target.closest('.option-item');

      if (optionEl && optionEl.getAttribute('data-value')) {
        const value = optionEl.getAttribute('data-value') as
          | 'public'
          | 'friends'
          | 'only_me';
        this.setPrivacyLevel(value);
        this.updatePrivacyDropdown();
        event.stopPropagation();
      }
      return;
    }

    // Handle privacy button click
    if (
      target.classList.contains('privacy-btn') ||
      target.closest('.privacy-btn')
    ) {
      this.togglePrivacyOptions();
      this.updatePrivacyDropdown();
      event.stopPropagation();
      return;
    }

    // Handle post button click
    if (
      target.classList.contains('post-button') &&
      !target.hasAttribute('disabled')
    ) {
      this.submitPost();
      event.stopPropagation();
      return;
    }

    // Handle remove file button click
    if (
      target.classList.contains('remove-file-btn') ||
      target.closest('.remove-file-btn')
    ) {
      const btnEl = target.classList.contains('remove-file-btn')
        ? target
        : target.closest('.remove-file-btn');

      if (btnEl && btnEl.getAttribute('data-index')) {
        const index = parseInt(btnEl.getAttribute('data-index') || '0', 10);
        this.removeFile(index);
        event.stopPropagation();
      }
      return;
    }
  };

  // Handle textarea input
  handleTextAreaInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.postContent = textarea.value;
    this.autoGrow(textarea);
  }

  // Open the create post modal
  openModal(): void {
    const modalContent = this.getModalHTML();
    this.modalService.openModal(modalContent);

    // Initialize textarea with current content
    setTimeout(() => {
      const textarea = document.querySelector(
        '.post-modal textarea'
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = this.postContent;
        textarea.addEventListener('input', (e) => this.handleTextAreaInput(e));
        this.autoGrow(textarea);
      }

      // Setup file input event listeners
      const photoInput = document.querySelector(
        '.post-modal input[accept="image/*"]'
      ) as HTMLInputElement;
      if (photoInput) {
        photoInput.addEventListener('change', (e) => this.onFileSelected(e));
      }

      const videoInput = document.querySelector(
        '.post-modal input[accept="video/*"]'
      ) as HTMLInputElement;
      if (videoInput) {
        videoInput.addEventListener('change', (e) => this.onFileSelected(e));
      }
    }, 0);
  }

  // Close the create post modal
  closeModal(): void {
    this.modalService.closeModal();
  }

  // Handle modal closed event
  handleModalClosed(): void {
    // Any cleanup needed when modal is closed
  }

  // Update the privacy dropdown visibility
  updatePrivacyDropdown(): void {
    const dropdown = document.querySelector('.privacy-dropdown');
    if (dropdown) {
      if (this.showPrivacyOptions) {
        dropdown.classList.remove('hidden');
      } else {
        dropdown.classList.add('hidden');
      }
    }

    // Update privacy button text and icon
    const btnText = document.querySelector('.privacy-text');
    const btnIcon = document.querySelector(
      '.privacy-btn .material-icons:first-child'
    );

    if (btnText && btnIcon) {
      btnText.textContent =
        this.privacyLevel === 'public'
          ? 'Public'
          : this.privacyLevel === 'friends'
          ? 'Friends'
          : 'Only Me';

      const iconElement = btnIcon as HTMLElement;
      iconElement.textContent =
        this.privacyLevel === 'public'
          ? 'public'
          : this.privacyLevel === 'friends'
          ? 'group'
          : 'lock';
    }
  }

  // Generate HTML for the modal
  private getModalHTML(): string {
    return `
      <div class="post-modal-overlay">
        <div class="post-modal">
          <!-- Modal header -->
          <div class="modal-header">
            <h2>Create Post</h2>
            <button class="close-btn">
              <span class="material-icons">close</span>
            </button>
          </div>

          <!-- Modal body -->
          <div class="modal-body">
            <!-- User info section -->
            <div class="user-info">
              <div class="user-avatar">
                <img src="${
                  this.userAvatar || '/assets/default-avatar.png'
                }" alt="Your avatar">
              </div>
              <div class="user-name">
                <span>${this.userName || 'You'}</span>
                
                <!-- Privacy dropdown -->
                <div class="privacy-selector">
                  <button class="privacy-btn">
                    <span class="material-icons">
                      ${
                        this.privacyLevel === 'public'
                          ? 'public'
                          : this.privacyLevel === 'friends'
                          ? 'group'
                          : 'lock'
                      }
                    </span>
                    <span class="privacy-text">
                      ${
                        this.privacyLevel === 'public'
                          ? 'Public'
                          : this.privacyLevel === 'friends'
                          ? 'Friends'
                          : 'Only Me'
                      }
                    </span>
                    <span class="material-icons">arrow_drop_down</span>
                  </button>
                  
                  <div class="privacy-dropdown ${
                    this.showPrivacyOptions ? '' : 'hidden'
                  }">
                    <div class="option-item" data-value="public">
                      <span class="material-icons">public</span>
                      <div class="option-details">
                        <span class="option-title">Public</span>
                        <span class="option-desc">Anyone can see this post</span>
                      </div>
                    </div>
                    <div class="option-item" data-value="friends">
                      <span class="material-icons">group</span>
                      <div class="option-details">
                        <span class="option-title">Friends</span>
                        <span class="option-desc">Only your friends can see this post</span>
                      </div>
                    </div>
                    <div class="option-item" data-value="only_me">
                      <span class="material-icons">lock</span>
                      <div class="option-details">
                        <span class="option-title">Only Me</span>
                        <span class="option-desc">Only you can see this post</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Post content textarea -->
            <div class="content-area">
              <textarea 
                placeholder="What's on your mind?" 
                ${this.isSubmitting ? 'disabled' : ''}
                rows="3">${this.postContent}</textarea>
            </div>

            <!-- Media preview area -->
            <div class="media-preview" id="media-preview-container" ${
              this.selectedFiles.length === 0 ? 'style="display:none;"' : ''
            }>
              ${this.getMediaPreviewHTML()}
            </div>

            <!-- Error message display -->
            ${
              this.error ? `<div class="error-message">${this.error}</div>` : ''
            }
          </div>

          <!-- Modal footer with action buttons -->
          <div class="modal-footer">
            <div class="add-to-post">
              <span>Add to your post</span>
              <div class="post-options">
                <!-- Photo upload option -->
                <label class="option-btn ${
                  this.isSubmitting ? 'disabled' : ''
                }" title="Add Photo">
                  <span class="material-icons">photo</span>
                  <input type="file" accept="image/*" multiple ${
                    this.isSubmitting ? 'disabled' : ''
                  } hidden>
                </label>
                
                <!-- Video upload option -->
                <label class="option-btn ${
                  this.isSubmitting ? 'disabled' : ''
                }" title="Add Video">
                  <span class="material-icons">videocam</span>
                  <input type="file" accept="video/*" ${
                    this.isSubmitting ? 'disabled' : ''
                  } hidden>
                </label>
                
                <!-- Poll option - disabled for now -->
                <button class="option-btn" disabled title="Create Poll (Coming Soon)">
                  <span class="material-icons">poll</span>
                </button>
              </div>
            </div>
            
            <!-- Post button -->
            <button 
              class="post-button" 
              ${
                this.isSubmitting ||
                (!this.postContent.trim() && this.selectedFiles.length === 0)
                  ? 'disabled'
                  : ''
              }>
              ${
                !this.isSubmitting
                  ? '<span>Post</span>'
                  : '<span class="spinner"></span><span>Posting...</span>'
              }
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Generate HTML for media previews
  private getMediaPreviewHTML(): string {
    if (this.selectedFiles.length === 0) return '';

    return this.selectedFiles
      .map((file, i) => {
        if (file.type.startsWith('image/')) {
          // For image files
          return `
          <div class="preview-item" data-index="${i}">
            <img src="${this.getFilePreviewUrl(
              file
            )}" alt="Selected image" class="media-thumbnail">
            <button class="remove-file-btn" data-index="${i}" ${
            this.isSubmitting ? 'disabled' : ''
          } title="Remove media">
              <span class="material-icons">close</span>
            </button>
          </div>
        `;
        } else {
          // For video files
          return `
          <div class="preview-item" data-index="${i}">
            <div class="video-thumbnail">
              <span class="material-icons video-icon">videocam</span>
              <span class="file-name">${file.name}</span>
            </div>
            <button class="remove-file-btn" data-index="${i}" ${
            this.isSubmitting ? 'disabled' : ''
          } title="Remove media">
              <span class="material-icons">close</span>
            </button>
          </div>
        `;
        }
      })
      .join('');
  }

  // Auto grow textarea based on content
  autoGrow(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  // Toggle privacy options dropdown
  togglePrivacyOptions(): void {
    this.showPrivacyOptions = !this.showPrivacyOptions;
  }

  // Set privacy level and close dropdown
  setPrivacyLevel(level: 'public' | 'friends' | 'only_me'): void {
    this.privacyLevel = level;
    this.showPrivacyOptions = false;
  }

  // Handle file selection
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      // Convert FileList to Array and add to selectedFiles
      const newFiles = Array.from(input.files);

      // Set post type based on the file type
      if (newFiles.length > 0) {
        if (newFiles[0].type.startsWith('image/')) {
          this.selectedPostType = PostType.PHOTO;
        } else if (newFiles[0].type.startsWith('video/')) {
          this.selectedPostType = PostType.VIDEO;
        }
      }

      this.selectedFiles = [...this.selectedFiles, ...newFiles];

      // Update media preview in the DOM
      this.updateMediaPreview();
    }
  }

  // Update media preview in the modal
  private updateMediaPreview(): void {
    const previewContainer = document.getElementById('media-preview-container');
    if (previewContainer) {
      if (this.selectedFiles.length > 0) {
        previewContainer.style.display = 'flex';
        previewContainer.innerHTML = this.getMediaPreviewHTML();
      } else {
        previewContainer.style.display = 'none';
      }
    }
  }

  // Remove a selected file
  removeFile(index: number): void {
    this.selectedFiles = this.selectedFiles.filter((_, i) => i !== index);

    // If no files left, revert to text post type
    if (this.selectedFiles.length === 0) {
      this.selectedPostType = PostType.TEXT;
    }

    // Update the media preview
    this.updateMediaPreview();
  }

  // Submit the post
  submitPost(): void {
    // Don't submit if empty or already submitting
    if (
      (!this.postContent.trim() && this.selectedFiles.length === 0) ||
      this.isSubmitting
    ) {
      return;
    }

    this.isSubmitting = true;
    this.error = '';
    this.updateSubmitButtonState();

    if (!this.authService.user) {
      this.error = 'You must be logged in to create a post';
      this.isSubmitting = false;
      this.updateErrorMessage();
      this.updateSubmitButtonState();
      return;
    }

    const userId = this.authService.user.id;

    // Create a new post object
    const newPost: Post = new Post({
      userId: userId,
      content: this.postContent.trim(),
      privacyLevel: this.privacyLevel,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // If we have files, upload them first then create the post
    if (this.selectedFiles.length > 0) {
      this.uploadFilesAndCreatePost(newPost);
    } else {
      // Otherwise just create the text post
      this.createTextPost(newPost);
    }
  }

  // Create a text-only post
  private createTextPost(post: Post): void {
    this.postService
      .createPost(post)
      .pipe(
        catchError((error) => {
          console.error('Error creating post:', error);

          // Special message for RLS policy violation
          if (
            error.code === '42501' &&
            error.message.includes('row-level security policy')
          ) {
            this.error =
              'Permission error: Unable to create post. Please contact an administrator to update your permissions.';
          } else {
            this.error = 'Failed to create post. Please try again.';
          }

          // Update error in DOM
          this.updateErrorMessage();

          return of(null);
        }),
        finalize(() => {
          this.isSubmitting = false;
          this.updateSubmitButtonState();
        })
      )
      .subscribe((createdPost) => {
        if (createdPost) {
          this.postCreated.emit(createdPost);
          this.resetForm();
          this.closeModal();
        }
      });
  }

  // Upload files and then create the post with media
  private uploadFilesAndCreatePost(post: Post): void {
    // First create the post to get an ID from Supabase
    this.postService
      .createPost(post)
      .pipe(
        catchError((error) => {
          console.error('Error creating post:', error);

          // Special message for RLS policy violation
          if (
            error.code === '42501' &&
            error.message.includes('row-level security policy')
          ) {
            this.error =
              'Permission error: Unable to create post. Please contact an administrator to update your permissions.';
          } else {
            this.error = 'Failed to create post. Please try again.';
          }

          this.updateErrorMessage();

          this.isSubmitting = false;
          this.updateSubmitButtonState();

          return of(null);
        })
      )
      .subscribe((createdPost) => {
        if (!createdPost) return; // Skip if post creation failed

        // Now upload media files using the generated post ID
        const uploadPromises = this.selectedFiles.map((file, index) => {
          const fileName = `${createdPost.id}/${index}-${file.name}`;
          return this.postService.uploadMedia(file, fileName);
        });

        // Process all uploads
        Promise.all(uploadPromises)
          .then((mediaUrls) => {
            // Create media objects for each uploaded file
            const mediaObjects = mediaUrls.map((url, index) => {
              return {
                postId: createdPost.id,
                url: url,
                mediaType: this.getMediaType(this.selectedFiles[index]),
                orderIndex: index,
              };
            });

            // Link media to the post
            this.postService
              .addMediaToPost(createdPost.id, mediaObjects)
              .pipe(
                catchError((error) => {
                  console.error('Error linking media to post:', error);
                  this.error =
                    'Your post was created but media could not be attached.';

                  this.updateErrorMessage();

                  return of(undefined);
                }),
                finalize(() => {
                  this.isSubmitting = false;
                  this.updateSubmitButtonState();
                })
              )
              .subscribe(() => {
                this.postCreated.emit(createdPost);
                this.resetForm();
                this.closeModal();
              });
          })
          .catch((err) => {
            console.error('Error uploading media:', err);
            this.error =
              'Your post was created but media could not be uploaded.';

            this.updateErrorMessage();

            this.isSubmitting = false;
            this.updateSubmitButtonState();

            this.postCreated.emit(createdPost);
            this.resetForm();
            this.closeModal();
          });
      });
  }

  // Update error message in the DOM
  private updateErrorMessage(): void {
    let errorContainer = document.querySelector('.error-message');

    if (this.error) {
      if (errorContainer) {
        errorContainer.textContent = this.error;
      } else {
        // Create error element if it doesn't exist
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
          errorContainer = document.createElement('div');
          errorContainer.className = 'error-message';
          errorContainer.textContent = this.error;
          modalBody.appendChild(errorContainer);
        }
      }
    } else if (errorContainer) {
      // Remove error element if there's no error
      errorContainer.parentNode?.removeChild(errorContainer);
    }
  }

  // Update submit button state in the DOM
  private updateSubmitButtonState(): void {
    const postBtn = document.querySelector('.post-button');
    if (postBtn) {
      if (
        this.isSubmitting ||
        (!this.postContent.trim() && this.selectedFiles.length === 0)
      ) {
        postBtn.setAttribute('disabled', 'true');
      } else {
        postBtn.removeAttribute('disabled');
      }

      // Update button content
      postBtn.innerHTML = !this.isSubmitting
        ? '<span>Post</span>'
        : '<span class="spinner"></span><span>Posting...</span>';
    }
  }

  // Reset the form after submission
  private resetForm(): void {
    this.postContent = '';
    this.selectedFiles = [];
    this.privacyLevel = 'public';
    this.showPrivacyOptions = false;
    this.selectedPostType = PostType.TEXT;
    this.error = '';
  }

  // Determine media type based on file
  private getMediaType(file: File): 'image' | 'video' {
    return file.type.startsWith('image/') ? 'image' : 'video';
  }

  // Get a preview URL for the selected file
  getFilePreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }
}
