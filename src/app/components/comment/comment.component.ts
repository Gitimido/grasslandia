// src/app/components/comment/comment.component.ts
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Comment, VoteType } from '../../models';
import { CommentService } from '../../core/services/comment.service';
import { LikeService } from '../../core/services/like.service';
import { AuthService } from '../../core/services/auth.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-comment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss'],
})
export class CommentComponent implements OnInit {
  @Input() comment!: Comment;
  @Input() isReply: boolean = false;
  @Output() deleted = new EventEmitter<string>();

  isLiked = false;
  likeCount = 0;
  isEditing = false;
  showReplyForm = false;
  replyContent = '';
  editContent = '';

  constructor(
    private commentService: CommentService,
    private likeService: LikeService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Check if user has liked this comment
    this.checkLikeStatus();
    // Get like count
    this.getLikeCount();
    // Get vote status and counts
    this.checkVoteStatus();
    this.getVoteCounts();
  }

  private checkLikeStatus(): void {
    this.likeService
      .hasUserLikedComment(this.comment.id)
      .subscribe((isLiked) => {
        this.isLiked = isLiked;
      });
  }

  private getLikeCount(): void {
    this.likeService.getCommentLikeCount(this.comment.id).subscribe((count) => {
      this.likeCount = count;
    });
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

  handleVote(type: string): void {
    if (!this.authService.isAuthenticated()) {
      // Redirect to login or show login modal
      return;
    }

    const voteType = type as VoteType;

    // Optimistic UI update
    const previousVote = this.comment.userVote;

    // If clicking the same button, remove the vote
    if (this.comment.userVote === voteType) {
      this.comment.userVote = null;
      if (voteType === VoteType.UPVOTE) {
        this.comment.upvotes = Math.max(0, (this.comment.upvotes || 0) - 1);
        this.comment.score = (this.comment.score || 0) - 1;
      } else {
        this.comment.downvotes = Math.max(0, (this.comment.downvotes || 0) - 1);
        this.comment.score = (this.comment.score || 0) + 1;
      }
    }
    // Otherwise if already voted differently, change the vote
    else if (this.comment.userVote) {
      this.comment.userVote = voteType;
      if (voteType === VoteType.UPVOTE) {
        this.comment.upvotes = (this.comment.upvotes || 0) + 1;
        this.comment.downvotes = Math.max(0, (this.comment.downvotes || 0) - 1);
        this.comment.score = (this.comment.score || 0) + 2; // +1 for adding upvote, +1 for removing downvote
      } else {
        this.comment.downvotes = (this.comment.downvotes || 0) + 1;
        this.comment.upvotes = Math.max(0, (this.comment.upvotes || 0) - 1);
        this.comment.score = (this.comment.score || 0) - 2; // -1 for adding downvote, -1 for removing upvote
      }
    }
    // Otherwise, add a new vote
    else {
      this.comment.userVote = voteType;
      if (voteType === VoteType.UPVOTE) {
        this.comment.upvotes = (this.comment.upvotes || 0) + 1;
        this.comment.score = (this.comment.score || 0) + 1;
      } else {
        this.comment.downvotes = (this.comment.downvotes || 0) + 1;
        this.comment.score = (this.comment.score || 0) - 1;
      }
    }

    // Send the vote to the server
    this.commentService.voteOnComment(this.comment.id, voteType).subscribe({
      error: (err) => {
        console.error('Error voting on comment:', err);
        // Revert the UI on error
        this.comment.userVote = previousVote;
        this.getVoteCounts(); // Refresh the counts from the server
      },
    });
  }

  toggleLike(): void {
    if (!this.authService.isAuthenticated()) {
      // Redirect to login or show login modal
      return;
    }

    if (this.isLiked) {
      this.likeService.unlikeComment(this.comment.id).subscribe({
        next: () => {
          this.isLiked = false;
          this.likeCount--;
        },
        error: (err) => console.error('Error unliking comment:', err),
      });
    } else {
      this.likeService.likeComment(this.comment.id).subscribe({
        next: () => {
          this.isLiked = true;
          this.likeCount++;
        },
        error: (err) => console.error('Error liking comment:', err),
      });
    }
  }

  toggleReplyForm(): void {
    if (!this.authService.isAuthenticated()) {
      // Redirect to login or show login modal
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
          if (!this.comment.replies) {
            this.comment.replies = [];
          }
          this.comment.replies.push(reply);
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

  // Helper method to fix the template error
  handleCommentDeleted(commentId: string): void {
    if (this.comment.replies) {
      this.comment.replies = this.comment.replies.filter(
        (reply) => reply.id !== commentId
      );
    }
  }

  getUserDisplayName(): string {
    if (!this.comment.user) return 'Anonymous';

    // Return first available: username > full name > 'User'
    return this.comment.user.username || this.comment.user.fullName || 'User';
  }
}
