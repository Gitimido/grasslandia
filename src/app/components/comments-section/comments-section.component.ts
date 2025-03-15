// src/app/components/comments-section/comments-section.component.ts
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommentService } from '../../core/services/comment.service';
import { AuthService } from '../../core/services/auth.service';
import { Comment } from '../../models';
import { CommentComponent } from '../comment/comment.component';
import { Store } from '@ngrx/store';
import {
  selectPostComments,
  selectIsLoading,
  selectError,
} from '../../core/store/Comments/comments.selectors';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-comments-section',
  standalone: true,
  imports: [CommonModule, FormsModule, CommentComponent],
  templateUrl: './comments-section.component.html',
  styleUrls: ['./comments-section.component.scss'],
})
export class CommentsSectionComponent implements OnInit, OnDestroy {
  @Input() postId!: string;

  // Use observables from store
  comments$!: Observable<Comment[]>;
  isLoading$!: Observable<boolean>;
  error$!: Observable<string | null>;

  newCommentContent: string = '';
  isLoadingMore = false;

  // Pagination and sorting
  offset = 0;
  limit = 5; // Initially show top 5 comments
  hasMoreComments = false;
  sortBy: 'top' | 'recent' = 'recent'; // Default sort by recent comments

  // Track subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private commentService: CommentService,
    private authService: AuthService,
    private store: Store
  ) {}

  ngOnInit(): void {
    // Initialize observables from store selectors
    this.isLoading$ = this.store.select(selectIsLoading);
    this.error$ = this.store.select(selectError);

    // Set initial sort order and load comments
    this.setSortBy('recent');
    this.loadComments();

    // Subscribe to comment count to determine if more comments can be loaded
    this.subscriptions.push(
      this.comments$.subscribe((comments) => {
        // If we received exactly the number of comments we requested,
        // there are probably more
        this.hasMoreComments = comments.length >= this.limit;

        // Update offset for potential future loads
        this.offset = comments.length;
      })
    );
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
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
      this.loadComments();
    }
  }

  loadComments(): void {
    this.commentService
      .getPostComments(this.postId, this.limit, 0, this.sortBy)
      .subscribe(); // No need to handle the response as it will be in the store
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
        complete: () => {
          this.isLoadingMore = false;
        },
        error: () => {
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
        next: () => {
          // Comment is added to store through the service
          this.newCommentContent = '';
        },
        error: (err) => {
          console.error('Error creating comment:', err);
        },
      });
  }

  // This method is still needed for component interaction
  handleCommentDeleted(commentId: string): void {
    // The deleted comment will be removed from the store automatically
    // through the service and real-time updates, so no action needed here
  }
}
