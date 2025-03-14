// src/app/components/comments-section/comments-section.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommentService } from '../../core/services/comment.service';
import { AuthService } from '../../core/services/auth.service';
import { Comment } from '../../models';
import { CommentComponent } from '../comment/comment.component';

@Component({
  selector: 'app-comments-section',
  standalone: true,
  imports: [CommonModule, FormsModule, CommentComponent],
  templateUrl: './comments-section.component.html',
  styleUrls: ['./comments-section.component.scss'],
})
export class CommentsSectionComponent implements OnInit {
  @Input() postId!: string;

  comments: Comment[] = [];
  visibleComments: Comment[] = [];
  newCommentContent: string = '';
  isLoading = true;
  isLoadingMore = false;
  error: string | null = null;

  // Pagination and sorting
  offset = 0;
  limit = 5; // Initially show top 5 comments
  hasMoreComments = false;
  sortBy: 'top' | 'recent' = 'top'; // Default sort by top comments

  constructor(
    private commentService: CommentService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.setSortBy('recent');
    this.loadComments();
  }

  get isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  // Method for textarea auto-grow
  autoGrow(element: HTMLTextAreaElement): void {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
  }

  // Set sort method and reload comments
  setSortBy(sort: 'top' | 'recent'): void {
    if (this.sortBy !== sort) {
      this.sortBy = sort;
      this.offset = 0;
      this.visibleComments = [];
      this.loadComments();
    }
  }

  loadComments(): void {
    this.isLoading = true;
    this.error = null;

    this.commentService
      .getPostComments(this.postId, this.limit, this.offset, this.sortBy)
      .subscribe({
        next: (comments) => {
          this.visibleComments = comments;

          // Check if there are more comments to load
          this.hasMoreComments = comments.length >= this.limit;

          // Update offset for next page
          this.offset = comments.length;

          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading comments:', err);
          this.error = 'Failed to load comments. Please try again.';
          this.isLoading = false;
        },
      });
  }

  // Load more comments (pagination)
  loadMoreComments(): void {
    this.isLoadingMore = true;

    this.commentService
      .getPostComments(
        this.postId,
        30, // Load more in batches of 30
        this.offset,
        this.sortBy
      )
      .subscribe({
        next: (moreComments) => {
          // Add to existing comments
          this.visibleComments = [...this.visibleComments, ...moreComments];

          // Check if there are more comments to load
          this.hasMoreComments = moreComments.length >= 30;

          // Update offset for next page
          this.offset += moreComments.length;

          this.isLoadingMore = false;
        },
        error: (err) => {
          console.error('Error loading more comments:', err);
          this.error = 'Failed to load more comments. Please try again.';
          this.isLoadingMore = false;
        },
      });
  }

  submitComment(): void {
    if (!this.newCommentContent.trim()) return;

    if (!this.isLoggedIn) {
      return;
    }

    this.commentService
      .createComment(this.postId, this.newCommentContent.trim())
      .subscribe({
        next: (comment) => {
          // Add new comment to the beginning of visible comments
          this.visibleComments.unshift(comment);
          this.newCommentContent = '';
        },
        error: (err) => {
          console.error('Error creating comment:', err);
          this.error = 'Failed to post comment. Please try again.';
        },
      });
  }

  handleCommentDeleted(commentId: string): void {
    this.visibleComments = this.visibleComments.filter(
      (c) => c.id !== commentId
    );
  }
}
