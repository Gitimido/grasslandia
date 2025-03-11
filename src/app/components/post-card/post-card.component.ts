import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Post } from '../../models';
import { MediaDisplayComponent } from '../media-display/media-display.component';
import { PostService } from '../../core/services/post.service';
import { AuthService } from '../../core/services/auth.service';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Media, IMedia } from '../../models';
@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, MediaDisplayComponent, RouterModule],
  templateUrl: './post-card.component.html',
  styleUrl: './post-card.component.scss',
})
export class PostCardComponent implements OnInit, OnDestroy {
  @Input() post!: Post;
  @Output() deleted = new EventEmitter<string>();

  isSaved = false;
  isHidden = false;
  currentUserId: string | null = null;
  showActions = false;
  private userSubscription?: Subscription;

  constructor(
    private postService: PostService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Get current user ID from the AuthService
    this.currentUserId = this.authService.user?.id || null;

    // Subscribe to user changes
    this.userSubscription = this.authService.user$.subscribe((user) => {
      this.currentUserId = user?.id || null;
      if (this.currentUserId && this.post) {
        this.checkSavedStatus();
      }
    });

    // Initial check if we already have a user
    if (this.currentUserId && this.post) {
      this.checkSavedStatus();
    }
  }

  ngOnDestroy(): void {
    // Clean up subscription to prevent memory leaks
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  checkSavedStatus(): void {
    if (!this.currentUserId) return;

    this.postService
      .isPostSaved(this.post.id, this.currentUserId)
      .subscribe((isSaved) => {
        this.isSaved = isSaved;
      });
  }

  toggleSavePost(): void {
    if (!this.authService.isAuthenticated()) {
      // Redirect to login or show login modal
      return;
    }

    if (this.isSaved) {
      this.postService
        .unsavePost(this.post.id, this.currentUserId!)
        .subscribe(() => {
          this.isSaved = false;
        });
    } else {
      this.postService
        .savePost(this.post.id, this.currentUserId!)
        .subscribe(() => {
          this.isSaved = true;
        });
    }
  }

  hidePost(): void {
    if (!this.authService.isAuthenticated()) {
      // Redirect to login or show login modal
      return;
    }

    this.postService
      .hidePost(this.post.id, this.currentUserId!)
      .subscribe(() => {
        this.isHidden = true;
      });
  }

  deletePost(): void {
    this.postService.deletePost(this.post.id).subscribe(() => {
      this.deleted.emit(this.post.id);
    });
  }

  sharePost(): void {
    this.postService.sharePost(this.post.id).subscribe((shareLink) => {
      navigator.clipboard.writeText(shareLink).then(() => {
        // Could use a toast/notification service here
        console.log('Link copied to clipboard');
      });
    });
  }

  toggleActions(): void {
    this.showActions = !this.showActions;
  }

  get isPostOwner(): boolean {
    return this.currentUserId === this.post.userId;
  }
}
