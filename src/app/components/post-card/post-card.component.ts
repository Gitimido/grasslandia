// src/app/components/post-card/post-card.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Post } from '../../models';
import { MediaDisplayComponent } from '../media-display/media-display.component';
import { PostService } from '../../core/services/post.service';
import { RouterModule } from '@angular/router';
import { Subscription, forkJoin, take, timer } from 'rxjs';
import { Media } from '../../models';
import { LikeService } from '../../core/services/like.service';
import { CommentService } from '../../core/services/comment.service';
import { CommentsSectionComponent } from '../comments-section/comments-section.component';
import { Store } from '@ngrx/store';
import {
  selectUser,
  selectIsAuthenticated,
} from '../../core/store/Auth/auth.selectors';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [
    CommonModule,
    MediaDisplayComponent,
    RouterModule,
    CommentsSectionComponent,
  ],
  templateUrl: './post-card.component.html',
  styleUrls: ['./post-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCardComponent implements OnInit, OnDestroy {
  @Input() post!: Post;
  @Output() deleted = new EventEmitter<string>();

  isSaved = false;
  isHidden = false;
  currentUserId: string | null = null;
  showActions = false;
  showComments = false; // Controls visibility of comments section
  isLiked = false;
  likeCount = 0;
  commentCount = 0;
  isLikeInProgress = false; // Flag to prevent multiple rapid clicks

  private userSubscription?: Subscription;
  private isAuthenticatedSubscription?: Subscription;
  private likeCountSubscription?: Subscription;
  private likeStatusSubscription?: Subscription;
  private commentCountSubscription?: Subscription;
  private subscriptions: Subscription[] = [];

  constructor(
    private postService: PostService,
    private likeService: LikeService,
    private commentService: CommentService,
    private store: Store,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to user from store
    this.userSubscription = this.store.select(selectUser).subscribe((user) => {
      this.currentUserId = user?.id || null;
      if (this.currentUserId && this.post) {
        this.checkSavedStatus();
        this.checkLikeStatus();
      }
    });

    // Get like count using observable
    this.likeCountSubscription = this.likeService
      .getPostLikesObservable(this.post.id)
      .subscribe((count) => {
        console.log(`Like count updated for post ${this.post.id}: ${count}`);
        this.likeCount = count;
        this.cdr.markForCheck();
      });

    // Get like status as continuous observable instead of one-time check
    this.likeStatusSubscription = this.likeService
      .getUserPostLikeObservable(this.post.id)
      .subscribe((liked) => {
        console.log(`Like status updated for post ${this.post.id}: ${liked}`);
        if (this.isLiked !== liked) {
          this.isLiked = liked;
          this.cdr.markForCheck();
        }
      });

    // Get comment count using reactive observable
    this.commentCountSubscription = this.commentService
      .getCommentCountObservable(this.post.id)
      .subscribe((count) => {
        this.commentCount = count;
        this.cdr.markForCheck();
      });

    // Force periodic checks to ensure UI stays in sync
    const syncInterval = timer(2000, 5000).subscribe(() => {
      if (this.currentUserId) {
        this.likeService
          .hasUserLikedPost(this.post.id)
          .subscribe((actualLiked) => {
            if (this.isLiked !== actualLiked) {
              console.log(
                `Correcting like state mismatch for post ${this.post.id}: UI=${this.isLiked}, Actual=${actualLiked}`
              );
              this.isLiked = actualLiked;
              this.cdr.markForCheck();
            }
          });
      }
    });

    this.subscriptions.push(syncInterval);
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }

    if (this.isAuthenticatedSubscription) {
      this.isAuthenticatedSubscription.unsubscribe();
    }

    if (this.likeCountSubscription) {
      this.likeCountSubscription.unsubscribe();
    }

    if (this.likeStatusSubscription) {
      this.likeStatusSubscription.unsubscribe();
    }

    if (this.commentCountSubscription) {
      this.commentCountSubscription.unsubscribe();
    }

    // Clean up any other subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  checkSavedStatus(): void {
    if (!this.currentUserId) return;

    this.postService
      .isPostSaved(this.post.id, this.currentUserId)
      .subscribe((isSaved) => {
        this.isSaved = isSaved;
        this.cdr.markForCheck();
      });
  }

  checkLikeStatus(): void {
    if (!this.currentUserId) return;

    this.likeService.hasUserLikedPost(this.post.id).subscribe((isLiked) => {
      if (this.isLiked !== isLiked) {
        console.log(
          `Setting initial like status for post ${this.post.id}: ${isLiked}`
        );
        this.isLiked = isLiked;
        this.cdr.markForCheck();
      }
    });
  }

  toggleLike(): void {
    // Prevent rapid clicking
    if (this.isLikeInProgress) {
      console.log('Like operation already in progress, ignoring click');
      return;
    }

    // Check authentication first
    this.store
      .select(selectIsAuthenticated)
      .pipe(take(1))
      .subscribe((isAuthenticated) => {
        if (!isAuthenticated) {
          console.log('User not authenticated');
          return;
        }

        this.isLikeInProgress = true;

        // Set a timeout to reset the flag even if operations fail
        setTimeout(() => {
          this.isLikeInProgress = false;
        }, 1500);

        // Update UI immediately for better feedback
        const wasLiked = this.isLiked;
        this.isLiked = !wasLiked;
        this.likeCount = wasLiked
          ? Math.max(0, this.likeCount - 1)
          : this.likeCount + 1;
        this.cdr.markForCheck();

        if (wasLiked) {
          console.log('Unliking post, previously liked state:', wasLiked);
          this.likeService.unlikePost(this.post.id).subscribe({
            next: () => {
              console.log('Unlike successful');
              this.isLikeInProgress = false;
              this.cdr.markForCheck();
            },
            error: (err) => {
              console.error('Error unliking post:', err);
              // Revert the UI on error
              this.isLiked = true;
              this.likeCount = this.likeCount + 1;
              this.isLikeInProgress = false;
              this.cdr.markForCheck();
            },
          });
        } else {
          console.log('Liking post, previously liked state:', wasLiked);
          this.likeService.likePost(this.post.id).subscribe({
            next: () => {
              console.log('Like successful');
              this.isLikeInProgress = false;
              this.cdr.markForCheck();
            },
            error: (err) => {
              console.error('Error liking post:', err);
              // Revert the UI on error
              this.isLiked = false;
              this.likeCount = Math.max(0, this.likeCount - 1);
              this.isLikeInProgress = false;
              this.cdr.markForCheck();
            },
          });
        }
      });
  }

  toggleComments(): void {
    console.log('Toggle comments clicked, current state:', this.showComments);
    this.showComments = !this.showComments;
    this.cdr.markForCheck();
  }

  toggleSavePost(): void {
    this.store
      .select(selectIsAuthenticated)
      .pipe(take(1))
      .subscribe((isAuthenticated) => {
        if (!isAuthenticated || !this.currentUserId) {
          return;
        }

        if (this.isSaved) {
          this.postService
            .unsavePost(this.post.id, this.currentUserId)
            .subscribe(() => {
              this.isSaved = false;
              this.cdr.markForCheck();
            });
        } else {
          this.postService
            .savePost(this.post.id, this.currentUserId)
            .subscribe(() => {
              this.isSaved = true;
              this.cdr.markForCheck();
            });
        }
      });
  }

  hidePost(): void {
    this.store
      .select(selectIsAuthenticated)
      .pipe(take(1))
      .subscribe((isAuthenticated) => {
        if (!isAuthenticated || !this.currentUserId) {
          return;
        }

        this.postService
          .hidePost(this.post.id, this.currentUserId)
          .subscribe(() => {
            this.isHidden = true;
            this.cdr.markForCheck();
          });
      });
  }

  deletePost(): void {
    this.postService.deletePost(this.post.id).subscribe({
      next: () => {
        this.deleted.emit(this.post.id);
      },
      error: (err) => {
        console.error('Error deleting post:', err);
      },
    });
  }

  sharePost(): void {
    this.postService.sharePost(this.post.id).subscribe((shareLink) => {
      navigator.clipboard.writeText(shareLink).then(() => {
        console.log('Link copied to clipboard');
      });
    });
  }

  toggleActions(): void {
    this.showActions = !this.showActions;
    this.cdr.markForCheck();
  }

  get isPostOwner(): boolean {
    return this.currentUserId === this.post.userId;
  }
}
