import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostCardComponent } from '../post-card/post-card.component';
import { Post } from '../../models';
import { PostService } from '../../core/services/post.service';
import { FeedStyle } from './feed-styles.enum';
import { of, Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, PostCardComponent],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss',
})
export class FeedComponent implements OnInit, OnDestroy {
  @Input() style: FeedStyle = FeedStyle.HOME; // Default to home style

  posts: Post[] = [];
  isLoading = true;
  error?: string;

  private subscriptions: Subscription[] = [];

  constructor(private postService: PostService) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach((sub) => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
  }

  // FIXED: Optimized version to minimize requests
  loadPosts(): void {
    this.isLoading = true;
    this.error = undefined;

    // First, get the posts without media
    const postSub = this.postService.getHomeFeed().subscribe({
      next: (posts: Post[]) => {
        console.log('Feed received posts:', posts);

        // Update the UI first with posts without media
        this.posts = posts;
        this.isLoading = false;

        // Then fetch media in a batch
        this.loadMediaForPosts(posts);
      },
      error: (err) => {
        this.error = 'Failed to load posts. Please try again later.';
        this.isLoading = false;
        console.error('Error loading home feed:', err);
      },
    });

    this.subscriptions.push(postSub);
  }

  // New method to batch load media for posts
  private loadMediaForPosts(posts: Post[]): void {
    if (!posts || posts.length === 0) return;

    // Extract all post IDs and shared post IDs
    const postIds = posts.map((post) => post.id);

    // Add shared post IDs
    const sharedPostIds = posts
      .filter((post) => post.sharedPostId)
      .map((post) => post.sharedPostId as string);

    // Create a unique list of all post IDs to fetch media for
    const allPostIds = [...new Set([...postIds, ...sharedPostIds])];

    // Batch fetch media for all posts at once
    const mediaSub = this.postService
      .getMediaForMultiplePosts(allPostIds)
      .pipe(
        finalize(() => {
          console.log('Media loading complete');
        })
      )
      .subscribe({
        next: (mediaMap: any) => {
          console.log('Received media for all posts:', mediaMap);

          // Update the posts with their media
          this.posts = this.posts.map((post) => {
            // Assign media to the post
            if (post.id in mediaMap) {
              post.media = mediaMap[post.id];
            }

            // If this is a shared post, assign media to the shared post
            if (
              post.sharedPostId &&
              post.sharedPost &&
              post.sharedPostId in mediaMap
            ) {
              post.sharedPost.media = mediaMap[post.sharedPostId];
            }

            return post;
          });
        },
        error: (err: any) => {
          console.error('Error loading media for posts:', err);
        },
      });

    this.subscriptions.push(mediaSub);
  }

  handlePostDeleted(postId: string): void {
    this.posts = this.posts.filter((post) => post.id !== postId);
  }
}
