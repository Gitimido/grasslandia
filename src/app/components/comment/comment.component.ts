// src/app/components/comment/comment.component.ts
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
import { FormsModule } from '@angular/forms';
import { Comment } from '../../models';
import { CommentService } from '../../core/services/comment.service';
import { LikeService } from '../../core/services/like.service';
import { AuthService } from '../../core/services/auth.service';
import { RouterModule } from '@angular/router';
import { Observable, Subscription, of, throwError, timer } from 'rxjs';
import { catchError, finalize, take, timeout } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { selectCommentReplies } from '../../core/store/Comments/comments.selectors';

@Component({
  selector: 'app-comment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush, // Use OnPush for better performance
})
export class CommentComponent implements OnInit, OnDestroy {
  @Input() comment!: Comment;
  @Input() isReply: boolean = false;
  @Input() replyDepth: number = 0;
  @Input() replyingToUsername?: string;
  @Output() deleted = new EventEmitter<string>();

  isLiked = false;
  likeCount = 0;
  isEditing = false;
  showReplyForm = false;
  replyContent = '';
  editContent = '';

  // Properties for expandable replies
  areRepliesExpanded = false;
  isLoadingReplies = false;
  isLoadingMoreReplies = false;
  repliesCount = 0;
  repliesLoaded = false;
  repliesOffset = 0;
  repliesLimit = 5; // Initial load limit
  hasMoreReplies = false;
  visibleReplies: Comment[] = [];

  // Track subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private commentService: CommentService,
    private likeService: LikeService,
    private authService: AuthService,
    private store: Store,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.getRepliesCount();

    // Subscribe to like count updates
    this.subscriptions.push(
      this.likeService
        .getCommentLikesObservable(this.comment.id)
        .subscribe((count) => {
          this.likeCount = count;
          this.cdr.markForCheck();
        })
    );

    // Subscribe to like status updates
    this.subscriptions.push(
      this.likeService
        .getUserCommentLikeObservable(this.comment.id)
        .subscribe((liked) => {
          this.isLiked = liked;
          this.cdr.markForCheck();
        })
    );

    // Subscribe to store updates for replies - FIXED
    this.subscriptions.push(
      this.store
        .select(selectCommentReplies(this.comment.id))
        .subscribe((replies) => {
          // Always update visible replies, even if empty
          this.visibleReplies = replies as Comment[];

          // Mark replies as loaded when we get a response
          if (this.isLoadingReplies) {
            this.repliesLoaded = true;
            this.isLoadingReplies = false;
          }

          // Update offset only if we have replies
          if (replies && replies.length > 0) {
            this.repliesOffset = replies.length;
          }

          // Reset loading flags
          if (this.isLoadingMoreReplies) {
            this.isLoadingMoreReplies = false;
          }

          this.cdr.markForCheck();
        })
    );
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  // Method to safely show @ symbol
  getReplyingToText(username: string): string {
    return '@' + username;
  }

  // Get just the count of replies
  private getRepliesCount(): void {
    this.subscriptions.push(
      this.commentService.getCommentRepliesCount(this.comment.id).subscribe({
        next: (count) => {
          this.repliesCount = count;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error getting replies count:', err);
          this.cdr.markForCheck();
        },
      })
    );
  }

  // Method to toggle expanding/collapsing replies - FIXED
  toggleReplies(): void {
    // Toggle state first, then load if needed
    this.areRepliesExpanded = !this.areRepliesExpanded;

    // Immediately mark for check to ensure UI responds
    this.cdr.markForCheck();

    // If expanding and not already loaded, load replies
    if (
      this.areRepliesExpanded &&
      (!this.repliesLoaded || this.visibleReplies.length === 0)
    ) {
      this.loadReplies();
    }
  }

  // Method to initially load replies - FIXED
  loadReplies(): void {
    // Skip if already loading
    if (this.isLoadingReplies) return;

    console.log(`Loading replies for comment ${this.comment.id}`);
    this.isLoadingReplies = true;
    this.cdr.markForCheck();

    // Add a safety timeout to ensure loading state gets reset
    const loadingTimeout = timer(10000).subscribe(() => {
      if (this.isLoadingReplies) {
        console.log('Loading replies timed out - resetting state');
        this.isLoadingReplies = false;
        this.cdr.markForCheck();
      }
    });

    this.commentService
      .getCommentReplies(
        this.comment.id,
        this.repliesLimit,
        0, // Always start from 0
        'recent' // Sort by newest first for better UX
      )
      .pipe(
        // Add timeout to ensure it doesn't hang forever
        timeout(8000),
        // Always make sure we reset loading state
        finalize(() => {
          loadingTimeout.unsubscribe();
          // Don't reset isLoadingReplies here, let the store subscription do it
          this.cdr.markForCheck();
        }),
        // Catch any errors and reset loading state
        catchError((err) => {
          console.error('Error loading replies:', err);
          this.isLoadingReplies = false;
          this.cdr.markForCheck();
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (replies) => {
          console.log(
            `Loaded ${replies.length} replies for comment ${this.comment.id}`
          );

          // The subscription to the store will update visibleReplies

          // Set hasMoreReplies flag based on what was loaded
          this.hasMoreReplies = replies.length >= this.repliesLimit;

          // Explicitly mark as loaded in case of empty results
          if (replies.length === 0) {
            this.repliesLoaded = true;
            this.isLoadingReplies = false;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          // Handle error here too, to provide better feedback
          console.error('Error in replies subscription:', err);
          this.isLoadingReplies = false;
          this.cdr.markForCheck();
        },
      });
  }

  // Method to load more replies (pagination) - FIXED
  loadMoreReplies(): void {
    if (this.isLoadingMoreReplies) return;

    this.isLoadingMoreReplies = true;
    this.cdr.markForCheck();

    // Add a safety timeout
    const loadingTimeout = timer(10000).subscribe(() => {
      if (this.isLoadingMoreReplies) {
        console.log('Loading more replies timed out - resetting state');
        this.isLoadingMoreReplies = false;
        this.cdr.markForCheck();
      }
    });

    this.commentService
      .getCommentReplies(
        this.comment.id,
        30, // Load more in batches of 30
        this.repliesOffset,
        'recent'
      )
      .pipe(
        timeout(8000),
        finalize(() => {
          loadingTimeout.unsubscribe();
          // Don't reset isLoadingMoreReplies here
          this.cdr.markForCheck();
        }),
        catchError((err) => {
          console.error('Error loading more replies:', err);
          this.isLoadingMoreReplies = false;
          this.cdr.markForCheck();
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (moreReplies) => {
          console.log(`Loaded ${moreReplies.length} more replies`);
          // Store updates will handle updating the visible replies
          // Just update the flags here
          this.hasMoreReplies = moreReplies.length >= 30;
        },
        error: (err) => {
          console.error('Error in more replies subscription:', err);
          this.isLoadingMoreReplies = false;
          this.cdr.markForCheck();
        },
      });
  }

  toggleLike(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    const wasLiked = this.isLiked;

    // Optimistic update
    this.isLiked = !this.isLiked;
    this.likeCount += wasLiked ? -1 : 1;
    this.cdr.markForCheck();

    if (wasLiked) {
      this.likeService.unlikeComment(this.comment.id).subscribe({
        error: (err) => {
          console.error('Error unliking comment:', err);
          // Revert on error
          this.isLiked = true;
          this.likeCount += 1;
          this.cdr.markForCheck();
        },
      });
    } else {
      this.likeService.likeComment(this.comment.id).subscribe({
        error: (err) => {
          console.error('Error liking comment:', err);
          // Revert on error
          this.isLiked = false;
          this.likeCount -= 1;
          this.cdr.markForCheck();
        },
      });
    }
  }

  toggleReplyForm(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }
    this.showReplyForm = !this.showReplyForm;
    if (!this.showReplyForm) {
      this.replyContent = '';
    }
    this.cdr.markForCheck();
  }

  toggleEditMode(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.editContent = this.comment.content;
    }
    this.cdr.markForCheck();
  }

  submitReply(): void {
    if (!this.replyContent.trim()) return;

    console.log(`Submitting reply to comment ${this.comment.id}`);

    // Disable form and store content
    const originalContent = this.replyContent.trim();
    this.replyContent = '';
    const wasReplyFormShown = this.showReplyForm;
    this.showReplyForm = false;
    this.cdr.markForCheck();

    this.commentService
      .createComment(this.comment.postId, originalContent, this.comment.id)
      .pipe(
        timeout(10000), // 10 second timeout
        catchError((err) => {
          console.error('Error creating reply:', err);

          // Restore form state on error
          this.replyContent = originalContent;
          this.showReplyForm = wasReplyFormShown;
          this.cdr.markForCheck();

          return throwError(() => err);
        })
      )
      .subscribe({
        next: (reply) => {
          console.log('Reply created successfully:', reply);

          // Set the replyingToUsername
          reply.replyingToUsername = this.comment.user?.username;

          // If replies weren't expanded, expand them to show the new reply
          if (!this.areRepliesExpanded) {
            this.areRepliesExpanded = true;
            // Don't set repliesLoaded here, let the subscription handle it
          }

          // Increment reply count
          this.repliesCount++;

          // Wait a moment then refresh the replies to ensure we see the new one
          setTimeout(() => {
            this.getRepliesCount();
            // Only reload if they weren't already loaded
            if (!this.repliesLoaded) {
              this.loadReplies();
            }
          }, 300);

          this.cdr.markForCheck();
        },
      });
  }

  saveEdit(): void {
    if (!this.editContent.trim() || this.editContent === this.comment.content) {
      this.isEditing = false;
      this.cdr.markForCheck();
      return;
    }

    // Store for potential rollback
    const originalContent = this.comment.content;
    const pendingContent = this.editContent.trim();

    // Optimistic update
    this.comment.content = pendingContent;
    this.isEditing = false;
    this.cdr.markForCheck();

    this.commentService
      .updateComment(this.comment.id, pendingContent)
      .subscribe({
        next: (updatedComment) => {
          // Handle success - update with server response
          this.comment = updatedComment;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error updating comment:', err);
          // Rollback on error
          this.comment.content = originalContent;
          this.cdr.markForCheck();
        },
      });
  }

  deleteComment(): void {
    if (confirm('Are you sure you want to delete this comment?')) {
      this.commentService.deleteComment(this.comment.id).subscribe({
        next: () => {
          this.deleted.emit(this.comment.id);
        },
        error: (err) => console.error('Error deleting comment:', err),
      });
    }
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.editContent = '';
    this.cdr.markForCheck();
  }

  get isCommentOwner(): boolean {
    return this.authService.user?.id === this.comment.userId;
  }

  // Check if comment has any replies (local knowledge)
  get hasReplies(): boolean {
    return this.visibleReplies.length > 0 || this.repliesCount > 0;
  }

  handleCommentDeleted(commentId: string): void {
    // Remove from visible replies locally
    this.visibleReplies = this.visibleReplies.filter(
      (reply) => reply.id !== commentId
    );

    // Decrement reply count
    this.repliesCount--;
    this.cdr.markForCheck();
  }
}
