import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  Renderer2,
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
  @Output() unsaved = new EventEmitter<string>();

  isSaved = false;
  isHidden = false;
  currentUserId: string | null = null;
  showActions = false;
  showComments = false; // Controls visibility of comments section
  isLiked = false;
  likeCount = 0;
  commentCount = 0;
  isLikeInProgress = false; // Flag to prevent multiple rapid clicks
  hasSharedPostMedia = false;

  // Share functionality
  sharesCount = 0;
  isShareModalOpen = false;
  shareComment = '';
  isSharing = false;
  shareTab: 'repost' | 'external' = 'repost';

  private userSubscription?: Subscription;
  private isAuthenticatedSubscription?: Subscription;
  private likeCountSubscription?: Subscription;
  private likeStatusSubscription?: Subscription;
  private commentCountSubscription?: Subscription;
  private shareCountSubscription?: Subscription;
  private subscriptions: Subscription[] = [];
  private modalElement: HTMLElement | null = null;

  constructor(
    private postService: PostService,
    private likeService: LikeService,
    private commentService: CommentService,
    private store: Store,
    private cdr: ChangeDetectorRef,
    private el: ElementRef,
    private renderer: Renderer2
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

    // Setup document click handler for modal
    this.renderer.listen('document', 'click', (event) => {
      if (this.isShareModalOpen && this.modalElement) {
        // Check if the click was on the overlay but NOT on the modal content
        if (this.modalElement === event.target) {
          // Click was directly on the overlay background
          this.closeShareModal();
          event.preventDefault();
          event.stopPropagation();
        }
      }
    });

    // Add media loading specifically for this post
    this.loadMediaForPost();
  }

  // Add this method to load media for the post
  loadMediaForPost(): void {
    console.log(`Loading media for post ${this.post.id}`);

    // Load media for the current post
    this.postService.getPostMedia(this.post.id).subscribe({
      next: (mediaItems) => {
        console.log(
          `Found ${mediaItems.length} media items for post ${this.post.id}:`,
          mediaItems
        );
        if (mediaItems && mediaItems.length > 0) {
          this.post.media = mediaItems;
          // Force change detection
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error(`Error loading media for post ${this.post.id}:`, err);
      },
    });

    // If it's a shared post, also load media for the shared post
    if (this.post.sharedPost && this.post.sharedPostId) {
      console.log(
        `This is a shared post. Loading media for shared post ${this.post.sharedPostId}`
      );

      this.postService.getPostMedia(this.post.sharedPostId).subscribe({
        next: (mediaItems) => {
          console.log(
            `Found ${mediaItems.length} media items for shared post ${this.post.sharedPostId}:`,
            mediaItems
          );

          if (this.post.sharedPost) {
            this.post.sharedPost.media = mediaItems;

            // Set a flag to track if there's media
            if (mediaItems && mediaItems.length > 0) {
              console.log('Setting hasSharedPostMedia flag to true');
              this.hasSharedPostMedia = true;
            }

            // Force change detection
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error(
            `Error loading media for shared post ${this.post.sharedPostId}:`,
            err
          );
        },
      });
    }
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

    // Remove modal if it exists
    this.closeShareModal();
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
              // Emit event when post is unsaved
              this.unsaved.emit(this.post.id);
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

  // Custom share modal implementation
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

        this.isShareModalOpen = true;
        this.shareComment = '';
        this.shareTab = 'repost';
        this.createShareModal();
        this.cdr.markForCheck();
      });
  }

  private createShareModal(): void {
    // Create modal container if it doesn't exist
    if (!this.modalElement) {
      this.modalElement = this.renderer.createElement('div');
      this.renderer.addClass(this.modalElement, 'share-modal-overlay');
      this.renderer.appendChild(document.body, this.modalElement);
    }

    // Add modal content
    this.renderShareModalContent();
  }

  private renderShareModalContent(): void {
    if (!this.modalElement) return;

    // Clear existing content
    this.modalElement.innerHTML = '';

    // Create modal content
    const modalContent = this.renderer.createElement('div');
    this.renderer.addClass(modalContent, 'share-modal');

    // Header
    const header = this.renderer.createElement('div');
    this.renderer.addClass(header, 'modal-header');

    const title = this.renderer.createElement('h3');
    this.renderer.appendChild(title, this.renderer.createText('Share Post'));

    const closeBtn = this.renderer.createElement('button');
    this.renderer.addClass(closeBtn, 'close-btn');
    this.renderer.listen(closeBtn, 'click', () => this.closeShareModal());

    const closeIcon = this.renderer.createElement('span');
    this.renderer.addClass(closeIcon, 'material-icons');
    this.renderer.appendChild(closeIcon, this.renderer.createText('close'));

    this.renderer.appendChild(closeBtn, closeIcon);
    this.renderer.appendChild(header, title);
    this.renderer.appendChild(header, closeBtn);
    this.renderer.appendChild(modalContent, header);

    // Tabs
    const tabsDiv = this.renderer.createElement('div');
    this.renderer.addClass(tabsDiv, 'share-tabs');

    const repostTab = this.renderer.createElement('button');
    this.renderer.addClass(repostTab, 'share-tab');
    if (this.shareTab === 'repost') this.renderer.addClass(repostTab, 'active');
    this.renderer.appendChild(repostTab, this.renderer.createText('Repost'));
    this.renderer.listen(repostTab, 'click', () => {
      this.shareTab = 'repost';
      this.renderShareModalContent();
    });

    const externalTab = this.renderer.createElement('button');
    this.renderer.addClass(externalTab, 'share-tab');
    if (this.shareTab === 'external')
      this.renderer.addClass(externalTab, 'active');
    this.renderer.appendChild(
      externalTab,
      this.renderer.createText('Share Externally')
    );
    this.renderer.listen(externalTab, 'click', () => {
      this.shareTab = 'external';
      this.renderShareModalContent();
    });

    this.renderer.appendChild(tabsDiv, repostTab);
    this.renderer.appendChild(tabsDiv, externalTab);
    this.renderer.appendChild(modalContent, tabsDiv);

    // Body
    const body = this.renderer.createElement('div');
    this.renderer.addClass(body, 'modal-body');

    // Post preview
    const previewDiv = this.renderer.createElement('div');
    this.renderer.addClass(previewDiv, 'original-post-preview');

    const previewHeader = this.renderer.createElement('div');
    this.renderer.addClass(previewHeader, 'preview-header');

    const avatar = this.renderer.createElement('img');
    this.renderer.setAttribute(
      avatar,
      'src',
      this.post.user?.avatarUrl || '/assets/default-avatar.png'
    );
    this.renderer.setAttribute(avatar, 'alt', 'User avatar');
    this.renderer.addClass(avatar, 'small-avatar');

    const previewUser = this.renderer.createElement('div');
    this.renderer.addClass(previewUser, 'preview-user');

    const usernameDiv = this.renderer.createElement('div');
    this.renderer.addClass(usernameDiv, 'preview-username');
    this.renderer.appendChild(
      usernameDiv,
      this.renderer.createText(this.post.user?.username || 'User')
    );

    const timeDiv = this.renderer.createElement('div');
    this.renderer.addClass(timeDiv, 'preview-time');
    this.renderer.appendChild(
      timeDiv,
      this.renderer.createText(this.post.timeSince)
    );

    this.renderer.appendChild(previewUser, usernameDiv);
    this.renderer.appendChild(previewUser, timeDiv);
    this.renderer.appendChild(previewHeader, avatar);
    this.renderer.appendChild(previewHeader, previewUser);
    this.renderer.appendChild(previewDiv, previewHeader);

    const previewContent = this.renderer.createElement('div');
    this.renderer.addClass(previewContent, 'preview-content');
    this.renderer.appendChild(
      previewContent,
      this.renderer.createText(this.post.content)
    );
    this.renderer.appendChild(previewDiv, previewContent);

    if (this.post.hasMedia) {
      const mediaIndicator = this.renderer.createElement('div');
      this.renderer.addClass(mediaIndicator, 'preview-media-indicator');
      this.renderer.appendChild(
        mediaIndicator,
        this.renderer.createText('Media content')
      );
      this.renderer.appendChild(previewDiv, mediaIndicator);
    }

    this.renderer.appendChild(body, previewDiv);

    // Tab content
    if (this.shareTab === 'repost') {
      const repostPane = this.renderer.createElement('div');
      this.renderer.addClass(repostPane, 'tab-pane');
      this.renderer.addClass(repostPane, 'active');

      const commentContainer = this.renderer.createElement('div');
      this.renderer.addClass(commentContainer, 'share-comment-container');

      const textarea = this.renderer.createElement('textarea');
      this.renderer.addClass(textarea, 'share-comment');
      this.renderer.setAttribute(
        textarea,
        'placeholder',
        'Add a comment to your repost...'
      );
      if (this.isSharing)
        this.renderer.setAttribute(textarea, 'disabled', 'true');
      this.renderer.appendChild(
        textarea,
        this.renderer.createText(this.shareComment)
      );
      this.renderer.listen(textarea, 'input', (event) => {
        this.shareComment = (event.target as HTMLTextAreaElement).value;
      });

      this.renderer.appendChild(commentContainer, textarea);
      this.renderer.appendChild(repostPane, commentContainer);

      const shareOptions = this.renderer.createElement('div');
      this.renderer.addClass(shareOptions, 'share-options');

      const shareBtn = this.renderer.createElement('button');
      this.renderer.addClass(shareBtn, 'share-btn');
      if (this.isSharing)
        this.renderer.setAttribute(shareBtn, 'disabled', 'true');

      if (this.isSharing) {
        const spinner = this.renderer.createElement('span');
        this.renderer.addClass(spinner, 'spinner');
        this.renderer.appendChild(shareBtn, spinner);
        this.renderer.appendChild(
          shareBtn,
          this.renderer.createText(' Sharing...')
        );
      } else {
        this.renderer.appendChild(shareBtn, this.renderer.createText('Repost'));
      }

      this.renderer.listen(shareBtn, 'click', () => this.submitShare());

      this.renderer.appendChild(shareOptions, shareBtn);
      this.renderer.appendChild(repostPane, shareOptions);
      this.renderer.appendChild(body, repostPane);
    } else {
      const externalPane = this.renderer.createElement('div');
      this.renderer.addClass(externalPane, 'tab-pane');
      this.renderer.addClass(externalPane, 'active');

      const externalOptions = this.renderer.createElement('div');
      this.renderer.addClass(externalOptions, 'external-share-options');

      const shareText = this.renderer.createElement('p');
      this.renderer.appendChild(
        shareText,
        this.renderer.createText('Share this post with others:')
      );

      const linkContainer = this.renderer.createElement('div');
      this.renderer.addClass(linkContainer, 'share-link-container');

      const linkInput = this.renderer.createElement('input');
      this.renderer.addClass(linkInput, 'share-link');
      this.renderer.setAttribute(linkInput, 'type', 'text');
      this.renderer.setAttribute(linkInput, 'readonly', 'true');
      this.renderer.setAttribute(
        linkInput,
        'value',
        `${window.location.origin}/post/${this.post.id}`
      );

      const copyBtn = this.renderer.createElement('button');
      this.renderer.addClass(copyBtn, 'copy-link-btn');
      this.renderer.appendChild(copyBtn, this.renderer.createText('Copy'));
      this.renderer.listen(copyBtn, 'click', () => this.copyLinkToClipboard());

      this.renderer.appendChild(linkContainer, linkInput);
      this.renderer.appendChild(linkContainer, copyBtn);

      const shareButtons = this.renderer.createElement('div');
      this.renderer.addClass(shareButtons, 'share-buttons');

      const externalShareBtn = this.renderer.createElement('button');
      this.renderer.addClass(externalShareBtn, 'share-external-btn');

      const shareIcon = this.renderer.createElement('span');
      this.renderer.addClass(shareIcon, 'material-icons');
      this.renderer.appendChild(shareIcon, this.renderer.createText('share'));

      this.renderer.appendChild(externalShareBtn, shareIcon);
      this.renderer.appendChild(
        externalShareBtn,
        this.renderer.createText(' Share')
      );
      this.renderer.listen(externalShareBtn, 'click', () =>
        this.shareExternally()
      );

      this.renderer.appendChild(shareButtons, externalShareBtn);
      this.renderer.appendChild(externalOptions, shareText);
      this.renderer.appendChild(externalOptions, linkContainer);
      this.renderer.appendChild(externalOptions, shareButtons);
      this.renderer.appendChild(externalPane, externalOptions);
      this.renderer.appendChild(body, externalPane);
    }

    this.renderer.appendChild(modalContent, body);

    // Footer
    const footer = this.renderer.createElement('div');
    this.renderer.addClass(footer, 'modal-footer');

    const cancelBtn = this.renderer.createElement('button');
    this.renderer.addClass(cancelBtn, 'cancel-share-btn');
    if (this.isSharing)
      this.renderer.setAttribute(cancelBtn, 'disabled', 'true');
    this.renderer.appendChild(cancelBtn, this.renderer.createText('Cancel'));
    this.renderer.listen(cancelBtn, 'click', () => this.closeShareModal());

    this.renderer.appendChild(footer, cancelBtn);
    this.renderer.appendChild(modalContent, footer);

    // Add modal to the overlay
    this.renderer.appendChild(this.modalElement, modalContent);
  }

  closeShareModal(): void {
    if (this.modalElement) {
      this.renderer.removeChild(document.body, this.modalElement);
      this.modalElement = null;
    }
    this.isShareModalOpen = false;
    this.cdr.markForCheck();
  }

  submitShare(): void {
    if (this.isSharing) return;

    this.isSharing = true;
    this.renderShareModalContent(); // Update UI to show loading state
    this.cdr.markForCheck();

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
          this.closeShareModal();
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
      this.closeShareModal();
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
