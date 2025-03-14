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
  newCommentContent: string = '';
  isLoading = true;
  error: string | null = null;

  constructor(
    private commentService: CommentService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    console.log('Comments section initialized for post:', this.postId);

    // Check authentication status
    const user = this.authService.user;
    console.log(
      'Current auth user:',
      user ? `${user.id} (${user.email})` : 'Not authenticated'
    );

    this.loadComments();
  }

  get isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  loadComments(): void {
    this.isLoading = true;
    this.error = null;

    this.commentService.getPostComments(this.postId).subscribe({
      next: (comments) => {
        this.comments = comments;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading comments:', err);
        this.error = 'Failed to load comments. Please try again.';
        this.isLoading = false;
      },
    });
  }

  submitComment(): void {
    if (!this.newCommentContent.trim()) return;

    if (!this.isLoggedIn) {
      // Handle not logged in state
      return;
    }

    this.commentService
      .createComment(this.postId, this.newCommentContent.trim())
      .subscribe({
        next: (comment) => {
          this.comments.push(comment);
          this.newCommentContent = '';
        },
        error: (err) => {
          console.error('Error creating comment:', err);
          this.error = 'Failed to post comment. Please try again.';
        },
      });
  }

  handleCommentDeleted(commentId: string): void {
    this.comments = this.comments.filter((c) => c.id !== commentId);
  }
}
