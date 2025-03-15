// src/app/components/comment/comment.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Comment, VoteType } from '../../models';
import { CommentService } from '../../core/services/comment.service';
import { LikeService } from '../../core/services/like.service';
import { AuthService } from '../../core/services/auth.service';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-comment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss'],
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

  // New properties for expandable replies
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
  private likeSubscription?: Subscription;
  private likeStatusSubscription?: Subscription;

  constructor(
    private commentService: CommentService,
    private likeService: LikeService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.checkVoteStatus();
    this.getVoteCounts();
    this.getRepliesCount();

    // Subscribe to like count updates
    this.likeSubscription = this.likeService
      .getCommentLikesObservable(this.comment.id)
      .subscribe((count) => {
        this.likeCount = count;
      });

    // Subscribe to like status updates
    this.likeStatusSubscription = this.likeService
      .getUserCommentLikeObservable(this.comment.id)
      .subscribe((liked) => {
        this.isLiked = liked;
      });
  }

  ngOnDestroy(): void {
    if (this.likeSubscription) {
      this.likeSubscription.unsubscribe();
    }

    if (this.likeStatusSubscription) {
      this.likeStatusSubscription.unsubscribe();
    }
  }

  private checkVoteStatus(): void {
    this.commentService
      .getUserVoteOnComment(this.comment.id)
      .subscribe((voteType) => {
        this.comment.userVote = voteType;
      });
  }

  private getVoteCounts(): void {
    this.commentService
      .getCommentVoteCounts(this.comment.id)
      .subscribe((counts) => {
        this.comment.upvotes = counts.upvotes;
        this.comment.downvotes = counts.downvotes;
        this.comment.score = counts.score;
      });
  }

  // New method to get just the count of replies
  private getRepliesCount(): void {
    this.commentService
      .getCommentRepliesCount(this.comment.id)
      .subscribe((count) => {
        this.repliesCount = count;
      });
  }

  // Method to safely show @ symbol
  getReplyingToText(username: string): string {
    return '@' + username;
  }

  // Method to toggle expanding/collapsing replies
  toggleReplies(): void {
    this.areRepliesExpanded = !this.areRepliesExpanded;

    // If expanding, load replies - whether or not they've been loaded before
    if (this.areRepliesExpanded) {
      this.loadReplies();
    }
  }

  // Method to initially load replies
  loadReplies(): void {
    this.isLoadingReplies = true;

    this.commentService
      .getCommentReplies(
        this.comment.id,
        this.repliesLimit,
        this.repliesOffset,
        'top'
      )
      .subscribe({
        next: (replies) => {
          // Store the replies
          this.visibleReplies = replies;
          this.repliesLoaded = true;

          // Check if there are more replies to load
          this.hasMoreReplies = replies.length >= this.repliesLimit;

          // Update offset for next page
          this.repliesOffset = replies.length;

          this.isLoadingReplies = false;
        },
        error: (err) => {
          console.error('Error loading replies:', err);
          this.isLoadingReplies = false;
        },
      });
  }

  // Method to load more replies (pagination)
  loadMoreReplies(): void {
    this.isLoadingMoreReplies = true;

    // Load the next batch of replies
    this.commentService
      .getCommentReplies(
        this.comment.id,
        30, // Load more in batches of 30
        this.repliesOffset,
        'top'
      )
      .subscribe({
        next: (moreReplies) => {
          // Add to existing replies
          this.visibleReplies = [...this.visibleReplies, ...moreReplies];

          // Check if there are more replies to load
          this.hasMoreReplies = moreReplies.length >= 30;

          // Update offset for next page
          this.repliesOffset += moreReplies.length;

          this.isLoadingMoreReplies = false;
        },
        error: (err) => {
          console.error('Error loading more replies:', err);
          this.isLoadingMoreReplies = false;
        },
      });
  }

  handleVote(type: string): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    const voteType = type as VoteType;
    const previousVote = this.comment.userVote;

    // Optimistic UI update logic
    if (this.comment.userVote === voteType) {
      this.comment.userVote = null;
      if (voteType === VoteType.UPVOTE) {
        this.comment.upvotes = Math.max(0, (this.comment.upvotes || 0) - 1);
        this.comment.score = (this.comment.score || 0) - 1;
      } else {
        this.comment.downvotes = Math.max(0, (this.comment.downvotes || 0) - 1);
        this.comment.score = (this.comment.score || 0) + 1;
      }
    } else if (this.comment.userVote) {
      this.comment.userVote = voteType;
      if (voteType === VoteType.UPVOTE) {
        this.comment.upvotes = (this.comment.upvotes || 0) + 1;
        this.comment.downvotes = Math.max(0, (this.comment.downvotes || 0) - 1);
        this.comment.score = (this.comment.score || 0) + 2;
      } else {
        this.comment.downvotes = (this.comment.downvotes || 0) + 1;
        this.comment.upvotes = Math.max(0, (this.comment.upvotes || 0) - 1);
        this.comment.score = (this.comment.score || 0) - 2;
      }
    } else {
      this.comment.userVote = voteType;
      if (voteType === VoteType.UPVOTE) {
        this.comment.upvotes = (this.comment.upvotes || 0) + 1;
        this.comment.score = (this.comment.score || 0) + 1;
      } else {
        this.comment.downvotes = (this.comment.downvotes || 0) + 1;
        this.comment.score = (this.comment.score || 0) - 1;
      }
    }

    // Send vote to server
    this.commentService.voteOnComment(this.comment.id, voteType).subscribe({
      error: (err) => {
        console.error('Error voting on comment:', err);
        this.comment.userVote = previousVote;
        this.getVoteCounts();
      },
    });
  }

  toggleLike(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    if (this.isLiked) {
      this.likeService.unlikeComment(this.comment.id).subscribe({
        error: (err) => console.error('Error unliking comment:', err),
      });
    } else {
      this.likeService.likeComment(this.comment.id).subscribe({
        error: (err) => console.error('Error liking comment:', err),
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
  }

  toggleEditMode(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.editContent = this.comment.content;
    }
  }

  submitReply(): void {
    if (!this.replyContent.trim()) return;

    this.commentService
      .createComment(
        this.comment.postId,
        this.replyContent.trim(),
        this.comment.id
      )
      .subscribe({
        next: (reply) => {
          reply.replyingToUsername = this.comment.user?.username;

          // Add the new reply to visible replies
          this.visibleReplies = [reply, ...this.visibleReplies];

          // If replies weren't expanded, expand them to show the new reply
          if (!this.areRepliesExpanded) {
            this.areRepliesExpanded = true;
            this.repliesLoaded = true;
          }

          // Increment reply count
          this.repliesCount++;

          this.replyContent = '';
          this.showReplyForm = false;
        },
        error: (err) => console.error('Error creating reply:', err),
      });
  }

  saveEdit(): void {
    if (!this.editContent.trim() || this.editContent === this.comment.content) {
      this.isEditing = false;
      return;
    }

    this.commentService
      .updateComment(this.comment.id, this.editContent.trim())
      .subscribe({
        next: (updatedComment) => {
          this.comment.content = updatedComment.content;
          this.comment.updatedAt = updatedComment.updatedAt;
          this.isEditing = false;
        },
        error: (err) => console.error('Error updating comment:', err),
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
  }

  get isCommentOwner(): boolean {
    return this.authService.user?.id === this.comment.userId;
  }

  // Check if comment has any replies (local knowledge)
  get hasReplies(): boolean {
    return this.visibleReplies.length > 0;
  }

  handleCommentDeleted(commentId: string): void {
    // Remove from visible replies
    this.visibleReplies = this.visibleReplies.filter(
      (reply) => reply.id !== commentId
    );

    // Decrement reply count
    this.repliesCount--;
  }
}
