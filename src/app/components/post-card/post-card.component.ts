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
import { Subscription, forkJoin, of, switchMap, throwError, timer } from 'rxjs';
import { finalize, take, tap, catchError } from 'rxjs/operators';
import { Media } from '../../models';
import { LikeService } from '../../core/services/like.service';
import { CommentService } from '../../core/services/comment.service';
import { CommentsSectionComponent } from '../comments-section/comments-section.component';
import { Store } from '@ngrx/store';
import {
  selectUser,
  selectIsAuthenticated,
} from '../../core/store/Auth/auth.selectors';
import { FormsModule } from '@angular/forms';
import { ModalService } from '../../core/services/model.service';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [
    CommonModule,
    MediaDisplayComponent,
    RouterModule,
    CommentsSectionComponent,
    FormsModule,
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

  // Share functionality
  sharesCount = 0;
  isShareModalOpen = false;
  shareComment = '';
  isSharing = false;

  private userSubscription?: Subscription;
  private isAuthenticatedSubscription?: Subscription;
  private likeCountSubscription?: Subscription;
  private likeStatusSubscription?: Subscription;
  private commentCountSubscription?: Subscription;
  private shareCountSubscription?: Subscription;
  private subscriptions: Subscription[] = [];

  constructor(
    private postService: PostService,
    private likeService: LikeService,
    private commentService: CommentService,
    private store: Store,
    private cdr: ChangeDetectorRef,
    private modalService: ModalService
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

    // Get share count using reactive observable
    this.shareCountSubscription = this.postService
      .getPostShareCount(this.post.id)
      .subscribe((count) => {
        this.sharesCount = count;
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

    if (this.shareCountSubscription) {
      this.shareCountSubscription.unsubscribe();
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

  // Enhanced sharePost method to open a modal for sharing
  sharePost(): void {
    // Check authentication first
    this.store
      .select(selectIsAuthenticated)
      .pipe(take(1))
      .subscribe((isAuthenticated) => {
        if (!isAuthenticated) {
          console.log('User not authenticated');
          // Could add a redirect to login here
          return;
        }

        // Open a modal dialog for sharing options
        this.isShareModalOpen = true;
        this.shareComment = '';
        this.createShareModal();
      });
  }

  private createShareModal(): void {
    const modalHTML = this.getShareModalHTML();
    this.modalService.openModal(modalHTML);

    // Setup event listeners
    setTimeout(() => {
      // Get the textarea and add event listener
      const textArea = document.querySelector(
        '.share-comment'
      ) as HTMLTextAreaElement;
      if (textArea) {
        textArea.focus();
        textArea.addEventListener('input', (e) => {
          this.shareComment = (e.target as HTMLTextAreaElement).value;
        });
      }

      // Add click event to share button
      const shareBtn = document.querySelector(
        '.share-btn'
      ) as HTMLButtonElement;
      if (shareBtn) {
        shareBtn.addEventListener('click', () => this.submitShare());
      }

      // Add click event to share-external button
      const shareExternalBtn = document.querySelector(
        '.share-external-btn'
      ) as HTMLButtonElement;
      if (shareExternalBtn) {
        shareExternalBtn.addEventListener('click', () =>
          this.shareExternally()
        );
      }

      // Add click event to cancel button
      const cancelBtn = document.querySelector(
        '.cancel-share-btn'
      ) as HTMLButtonElement;
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.modalService.closeModal();
        });
      }
    }, 0);
  }

  private getShareModalHTML(): string {
    // Get user avatar and name for share preview
    const userAvatar = this.currentUserId
      ? this.post.user?.avatarUrl || '/assets/default-avatar.png'
      : '/assets/default-avatar.png';

    const userName = this.post.user?.username || 'User';

    return `
      <div class="share-modal-overlay">
        <div class="share-modal">
          <div class="modal-header">
            <h3>Share Post</h3>
            <button class="close-btn">
              <span class="material-icons">close</span>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="share-tabs">
              <button class="share-tab active" data-tab="repost">Repost</button>
              <button class="share-tab" data-tab="external">Share Externally</button>
            </div>
            
            <div class="share-tab-content">
              <div class="original-post-preview">
                <div class="preview-header">
                  <img src="${
                    this.post.user?.avatarUrl || '/assets/default-avatar.png'
                  }" alt="User avatar" class="small-avatar">
                  <div class="preview-user">
                    <div class="preview-username">${
                      this.post.user?.username || 'User'
                    }</div>
                    <div class="preview-time">${this.post.timeSince}</div>
                  </div>
                </div>
                <div class="preview-content">${this.post.content}</div>
                ${
                  this.post.hasMedia
                    ? '<div class="preview-media-indicator">Media content</div>'
                    : ''
                }
              </div>
              
              <div id="repost-tab" class="tab-pane active">
                <div class="share-comment-container">
                  <textarea 
                    placeholder="Add a comment to your repost..." 
                    class="share-comment"
                    ${this.isSharing ? 'disabled' : ''}
                  >${this.shareComment}</textarea>
                </div>
                
                <div class="share-options">
                  <button class="share-btn" ${this.isSharing ? 'disabled' : ''}>
                    ${
                      this.isSharing
                        ? '<span class="spinner"></span> Sharing...'
                        : 'Repost'
                    }
                  </button>
                </div>
              </div>
              
              <div id="external-tab" class="tab-pane">
                <div class="external-share-options">
                  <p>Share this post with others:</p>
                  <div class="share-link-container">
                    <input type="text" class="share-link" readonly value="${
                      window.location.origin
                    }/post/${this.post.id}">
                    <button class="copy-link-btn">Copy</button>
                  </div>
                  
                  <div class="share-buttons">
                    <button class="share-external-btn">
                      <span class="material-icons">share</span>
                      Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="cancel-share-btn" ${
              this.isSharing ? 'disabled' : ''
            }>Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  submitShare(): void {
    if (this.isSharing) return;

    this.isSharing = true;
    this.cdr.markForCheck();

    // Update the button state in the DOM
    const shareBtn = document.querySelector('.share-btn') as HTMLButtonElement;
    if (shareBtn) {
      shareBtn.disabled = true;
      shareBtn.innerHTML = '<span class="spinner"></span> Sharing...';
    }

    this.postService
      .sharePost(this.post.id, this.shareComment)
      .pipe(
        // Force reload the share count after success
        switchMap(() => this.postService.getPostShareCount(this.post.id)),
        catchError((error) => {
          console.error('Error sharing post:', error);
          return throwError(() => error);
        }),
        finalize(() => {
          this.isSharing = false;
          this.modalService.closeModal();
          this.cdr.markForCheck();

          // Refresh the feed if possible
          this.refreshFeed();
        })
      )
      .subscribe({
        next: (count) => {
          this.sharesCount = count;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Share error:', error);

          // Reset UI state
          const shareBtn = document.querySelector(
            '.share-btn'
          ) as HTMLButtonElement;
          if (shareBtn) {
            shareBtn.disabled = false;
            shareBtn.innerHTML = 'Repost';
          }
        },
      });
  }

  shareExternally(): void {
    if (navigator.share) {
      // Use Web Share API if available
      navigator
        .share({
          title: 'Check out this post',
          text:
            this.post.content.substring(0, 100) +
            (this.post.content.length > 100 ? '...' : ''),
          url: `${window.location.origin}/post/${this.post.id}`,
        })
        .then(() => console.log('Successful share'))
        .catch((error) => console.log('Error sharing:', error));
    } else {
      // Fallback to clipboard
      this.copyLinkToClipboard();
    }
  }

  copyLinkToClipboard(): void {
    const shareLink = `${window.location.origin}/post/${this.post.id}`;
    navigator.clipboard.writeText(shareLink).then(() => {
      alert('Link copied to clipboard!');
      this.modalService.closeModal();
    });
  }

  private refreshFeed(): void {
    // Find feed component and refresh
    const feedComponent = document.querySelector('app-feed');
    if (feedComponent) {
      try {
        (feedComponent as any).loadPosts();
      } catch (err) {
        console.error('Error refreshing feed:', err);
      }
    }
  }

  toggleActions(): void {
    this.showActions = !this.showActions;
    this.cdr.markForCheck();
  }

  get isPostOwner(): boolean {
    return this.currentUserId === this.post.userId;
  }
}
