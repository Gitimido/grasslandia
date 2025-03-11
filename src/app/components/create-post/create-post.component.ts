import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../core/services/post.service';
import { AuthService } from '../../core/services/auth.service';
import { Post } from '../../models';
import { catchError, finalize, of } from 'rxjs';

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
  styleUrl: './create-post.component.scss',
})
export class CreatePostComponent {
  @Output() postCreated = new EventEmitter<Post>();

  postContent = '';
  selectedFiles: File[] = [];
  isSubmitting = false;
  privacyLevel: 'public' | 'friends' | 'only_me' = 'public';
  error = '';
  showPrivacyOptions = false;

  // Post type selection
  postTypes = PostType;
  selectedPostType: PostType = PostType.TEXT;

  constructor(
    private postService: PostService,
    private authService: AuthService
  ) {}

  // Set post type
  setPostType(type: PostType): void {
    this.selectedPostType = type;

    // If switching away from photo/video type and we have files selected, clear them
    if (
      type !== PostType.PHOTO &&
      type !== PostType.VIDEO &&
      this.selectedFiles.length > 0
    ) {
      if (
        confirm('Changing post type will clear your selected media. Continue?')
      ) {
        this.selectedFiles = [];
      } else {
        // If user cancels, keep the original post type
        this.selectedPostType = this.selectedFiles[0]?.type.startsWith('image/')
          ? PostType.PHOTO
          : PostType.VIDEO;
      }
    }
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
    }
  }

  // Remove a selected file
  removeFile(index: number): void {
    this.selectedFiles = this.selectedFiles.filter((_, i) => i !== index);

    // If no files left, revert to text post type
    if (this.selectedFiles.length === 0) {
      this.selectedPostType = PostType.TEXT;
    }
  }

  // Toggle privacy options menu
  togglePrivacyOptions(): void {
    this.showPrivacyOptions = !this.showPrivacyOptions;
  }

  // Set privacy level and close menu
  setPrivacyLevel(level: 'public' | 'friends' | 'only_me'): void {
    this.privacyLevel = level;
    this.showPrivacyOptions = false;
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

    if (!this.authService.user) {
      this.error = 'You must be logged in to create a post';
      this.isSubmitting = false;
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

          return of(null);
        }),
        finalize(() => {
          this.isSubmitting = false;
        })
      )
      .subscribe((createdPost) => {
        if (createdPost) {
          this.postCreated.emit(createdPost);
          this.resetForm();
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

          this.isSubmitting = false;
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
                  return of(undefined);
                }),
                finalize(() => {
                  this.isSubmitting = false;
                })
              )
              .subscribe(() => {
                this.postCreated.emit(createdPost);
                this.resetForm();
              });
          })
          .catch((err) => {
            console.error('Error uploading media:', err);
            this.error =
              'Your post was created but media could not be uploaded.';
            this.isSubmitting = false;
            this.postCreated.emit(createdPost);
            this.resetForm();
          });
      });
  }

  // Reset the form after submission
  private resetForm(): void {
    this.postContent = '';
    this.selectedFiles = [];
    this.privacyLevel = 'public';
    this.showPrivacyOptions = false;
    this.selectedPostType = PostType.TEXT;
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
