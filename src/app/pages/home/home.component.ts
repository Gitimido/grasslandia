// src/app/pages/home/home.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeedComponent } from '../../components/feed/feed.component';
import { CreatePostComponent } from '../../components/create-post/create-post.component';
import { FeedStyle } from '../../components/feed/feed-styles.enum';
import { SideNavService } from '../../core/services/side-nav.service';
import { Post } from '../../models';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { selectIsAuthenticated } from '../../core/store/Auth/auth.selectors';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [CommonModule, FeedComponent, CreatePostComponent],
})
export class HomeComponent implements OnInit {
  // For the feed styling
  feedStyle = FeedStyle.HOME;
  isSidebarCollapsed = false;
  isLoggedIn$: Observable<boolean>;

  constructor(private sideNavService: SideNavService, private store: Store) {
    this.isLoggedIn$ = this.store.select(selectIsAuthenticated);
  }

  ngOnInit(): void {
    // Subscribe to sidebar collapse state
    this.sideNavService.sidebarState.subscribe((isCollapsed) => {
      this.isSidebarCollapsed = isCollapsed;
    });
  }

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
