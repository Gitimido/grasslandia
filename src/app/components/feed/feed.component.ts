// src/app/components/feed/feed.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostCardComponent } from '../post-card/post-card.component';
import { Post } from '../../models';
import { PostService } from '../../core/services/post.service';
import { FeedStyle } from './feed-styles.enum';

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

  // Public method to reload posts
  loadPosts(): void {
    this.isLoading = true;
    this.error = undefined;

    this.postService.getHomeFeed().subscribe({
      next: (posts: Post[]) => {
        this.posts = posts;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load posts. Please try again later.';
        this.isLoading = false;
        console.error('Error loading home feed:', err);
      },
    });
  }
  private loadHomePosts(): void {
    this.postService.getHomeFeed().subscribe({
      next: (posts: Post[]) => {
        this.posts = posts;
        this.isLoading = false;
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
