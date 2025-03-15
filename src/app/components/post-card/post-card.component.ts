// src/app/components/post-card/post-card.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Post } from '../../models';
import { MediaDisplayComponent } from '../media-display/media-display.component';
import { PostService } from '../../core/services/post.service';
import { RouterModule } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
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
  private userSubscription?: Subscription;
  private isAuthenticatedSubscription?: Subscription;

  constructor(
    private postService: PostService,
    private likeService: LikeService,
    private commentService: CommentService,
    private store: Store
  ) {}

  ngOnInit(): void {
    // Subscribe to user from store
    this.userSubscription = this.store.select(selectUser).subscribe((user) => {
      this.currentUserId = user?.id || null;
      console.log('Current user ID:', this.currentUserId);

      if (this.currentUserId && this.post) {
        this.checkSavedStatus();
        this.checkLikeStatus();
      }
    });

    // Get counts
    this.getCounts();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }

    if (this.isAuthenticatedSubscription) {
      this.isAuthenticatedSubscription.unsubscribe();
    }
  }

  checkSavedStatus(): void {
    if (!this.currentUserId) return;

    this.postService
      .isPostSaved(this.post.id, this.currentUserId)
      .subscribe((isSaved) => {
        this.isSaved = isSaved;
      });
  }

  checkLikeStatus(): void {
    if (!this.currentUserId) return;

    this.likeService.hasUserLikedPost(this.post.id).subscribe((isLiked) => {
      this.isLiked = isLiked;
      console.log('Post liked status:', isLiked);
    });
  }

  getCounts(): void {
    // Use forkJoin to get both counts in parallel
    forkJoin({
      likes: this.likeService.getPostLikeCount(this.post.id),
      comments: this.commentService.getCommentCount(this.post.id),
    }).subscribe(({ likes, comments }) => {
      this.likeCount = likes;
      this.commentCount = comments;
      console.log(`Post has ${likes} likes and ${comments} comments`);
    });
  }

  toggleLike(): void {
    console.log('Toggle like clicked');

    // Check authentication state from store
    this.isAuthenticatedSubscription = this.store
      .select(selectIsAuthenticated)
      .subscribe((isAuthenticated) => {
        if (!isAuthenticated) {
          console.log('User not authenticated');
          return;
        }

        if (this.isLiked) {
          console.log('Unliking post');
          this.likeService.unlikePost(this.post.id).subscribe({
            next: () => {
              console.log('Unlike successful');
              this.isLiked = false;
              this.likeCount--;
            },
            error: (err) => console.error('Error unliking post:', err),
          });
        } else {
          console.log('Liking post');
          this.likeService.likePost(this.post.id).subscribe({
            next: () => {
              console.log('Like successful');
              this.isLiked = true;
              this.likeCount++;
            },
            error: (err) => console.error('Error liking post:', err),
          });
        }
      });
  }

  toggleComments(): void {
    console.log('Toggle comments clicked, current state:', this.showComments);
    this.showComments = !this.showComments;
    console.log('New comments visibility state:', this.showComments);
  }

  toggleSavePost(): void {
    this.store
      .select(selectIsAuthenticated)
      .subscribe((isAuthenticated) => {
        if (!isAuthenticated) {
          return;
        }

        if (this.isSaved) {
          this.postService
            .unsavePost(this.post.id, this.currentUserId!)
            .subscribe(() => {
              this.isSaved = false;
            });
        } else {
          this.postService
            .savePost(this.post.id, this.currentUserId!)
            .subscribe(() => {
              this.isSaved = true;
            });
        }
      })
      .unsubscribe();
  }

  hidePost(): void {
    this.store
      .select(selectIsAuthenticated)
      .subscribe((isAuthenticated) => {
        if (!isAuthenticated) {
          return;
        }

        this.postService
          .hidePost(this.post.id, this.currentUserId!)
          .subscribe(() => {
            this.isHidden = true;
          });
      })
      .unsubscribe();
  }

  deletePost(): void {
    this.postService.deletePost(this.post.id).subscribe(() => {
      this.deleted.emit(this.post.id);
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
  }

  get isPostOwner(): boolean {
    return this.currentUserId === this.post.userId;
  }
}
