// src/app/components/comments-section/comments-section.component.ts
import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
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
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-comments-section',
  standalone: true,
  imports: [CommonModule, FormsModule, CommentComponent, RouterModule],
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

  // Local state properties
  visibleComments: Comment[] = [];
  isLoading = true;
  error?: string;

  // Pagination and sorting
  offset = 0;
  limit = 10; // Initially show top 10 comments
  hasMoreComments = false;
  sortBy: 'top' | 'recent' = 'recent'; // Default sort by recent comments

  // Track subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private commentService: CommentService,
    private authService: AuthService,
    private store: Store,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Initialize observables from store selectors
    this.isLoading$ = this.store.select(selectIsLoading);
    this.error$ = this.store.select(selectError);
    this.comments$ = this.store.select(
      selectPostComments(this.postId)
    ) as Observable<Comment[]>;

    // Set initial sort order and load comments
    this.setSortBy('recent');
    this.loadComments();

    // Subscribe to loading state from store
    this.subscriptions.push(
      this.isLoading$.subscribe((loading) => {
        this.isLoading = loading;
        this.cdr.markForCheck();
      })
    );

    // Subscribe to comments to update visible comments
    this.subscriptions.push(
      this.comments$.subscribe((comments) => {
        this.visibleComments = comments;

        // If we received exactly the number of comments we requested,
        // there are probably more
        this.hasMoreComments = comments.length >= this.limit;

        // Update offset for potential future loads
        this.offset = comments.length;
        this.cdr.markForCheck();
      })
    );

    // Subscribe to error state
    this.subscriptions.push(
      this.error$.subscribe((errorMsg) => {
        this.error = errorMsg || undefined;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
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
      .subscribe({
        // The store will be updated by the service, no need to handle the response here
        error: (err) => {
          console.error('Error loading comments:', err);
        },
      });
  }

  // Load more comments (pagination)
  loadMoreComments(): void {
    if (this.isLoadingMore) return;

    this.isLoadingMore = true;

    this.commentService
      .getPostComments(
        this.postId,
        30, // Load more in batches of 30
        this.offset,
        this.sortBy
      )
      .subscribe({
        next: (additionalComments) => {
          this.hasMoreComments = additionalComments.length >= 30;
          this.isLoadingMore = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading more comments:', err);
          this.isLoadingMore = false;
          this.cdr.markForCheck();
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
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error creating comment:', err);
        },
      });
  }

  handleCommentDeleted(commentId: string): void {
    // The deleted comment will be removed from the store automatically
    // We just need to ensure our local state is updated
    this.visibleComments = this.visibleComments.filter(
      (c) => c.id !== commentId
    );
    this.cdr.markForCheck();
  }
}
