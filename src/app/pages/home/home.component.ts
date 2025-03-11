// src/app/pages/home/home.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopBarComponent } from '../../components/top-bar/top-bar.component';
import { FeedComponent } from '../../components/feed/feed.component';
import { CreatePostComponent } from '../../components/create-post/create-post.component';
import { AuthDebugComponent } from '../../components/auth-debug/auth-debug.component';
import { FeedStyle } from '../../components/feed/feed-styles.enum';
import { AuthService } from '../../core/services/auth.service';
import { Post } from '../../models';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TopBarComponent,
    FeedComponent,
    CreatePostComponent,
    AuthDebugComponent,
  ],
})
export class HomeComponent {
  // For the feed styling
  feedStyle = FeedStyle.HOME;

  // Track if user is logged in to show/hide create post component
  get isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  constructor(private authService: AuthService) {}

  handlePostCreated(post: Post): void {
    console.log('Post created successfully:', post.id);

    // Find the feed component and refresh its posts
    const feedComponent = document.querySelector('app-feed');
    if (feedComponent) {
      try {
        // Cast to any since we know FeedComponent has loadPosts method now
        (feedComponent as any).loadPosts();
      } catch (err) {
        console.error('Error refreshing feed:', err);
        // Fallback to page reload if method call fails
        window.location.reload();
      }
    } else {
      console.warn('Feed component not found, cannot refresh');
    }
  }
}
