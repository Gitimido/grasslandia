// src/app/components/feed/feed.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostCardComponent } from '../post-card/post-card.component';
import { Post, Media } from '../../models';
import { PostService } from '../../core/services/post.service';
import { FeedStyle } from './feed-styles.enum';
import { forkJoin, of, Observable } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, PostCardComponent],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss',
})
export class FeedComponent implements OnInit {
  @Input() style: FeedStyle = FeedStyle.HOME; // Default to home style

  posts: Post[] = [];
  isLoading = true;
  error?: string;

  constructor(private postService: PostService) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  // Public method to reload posts with media
  loadPosts(): void {
    this.isLoading = true;
    this.error = undefined;

    this.postService.getHomeFeed().subscribe({
      next: (posts: Post[]) => {
        console.log('Feed received posts:', posts);

        // For each post, load its media
        const postsWithMediaTasks: Observable<Post>[] = posts.map((post) => {
          return this.postService.getPostMedia(post.id).pipe(
            switchMap((media: Media[]) => {
              console.log(
                `Feed loaded ${media.length} media items for post ${post.id}`
              );
              post.media = media;

              // If it's a shared post, also load its media
              if (post.sharedPost && post.sharedPostId) {
                return this.postService.getPostMedia(post.sharedPostId).pipe(
                  map((sharedMedia: Media[]) => {
                    console.log(
                      `Feed loaded ${sharedMedia.length} media items for shared post ${post.sharedPostId}`
                    );
                    if (post.sharedPost) {
                      post.sharedPost.media = sharedMedia;
                    }
                    return post;
                  }),
                  catchError((err) => {
                    console.error(
                      `Error loading shared post media for ${post.sharedPostId}:`,
                      err
                    );
                    return of(post);
                  })
                );
              }

              return of(post);
            }),
            catchError((err) => {
              console.error(`Error loading media for post ${post.id}:`, err);
              return of(post);
            })
          );
        });

        // Wait for all media loading to complete
        forkJoin(postsWithMediaTasks).subscribe({
          next: (postsWithMedia) => {
            this.posts = postsWithMedia;
            this.isLoading = false;
            console.log('All posts with media loaded:', this.posts);
          },
          error: (err) => {
            console.error('Error loading posts with media:', err);
            this.error =
              'Failed to load posts with media. Please try again later.';
            this.isLoading = false;
          },
        });
      },
      error: (err) => {
        this.error = 'Failed to load posts. Please try again later.';
        this.isLoading = false;
        console.error('Error loading home feed:', err);
      },
    });
  }

  handlePostDeleted(postId: string): void {
    this.posts = this.posts.filter((post) => post.id !== postId);
  }
}
