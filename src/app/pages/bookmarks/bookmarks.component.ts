// src/app/pages/bookmarks/bookmarks.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PostCardComponent } from '../../components/post-card/post-card.component';
import { SideNavService } from '../../core/services/side-nav.service';
import { PostService } from '../../core/services/post.service';
import { AuthService } from '../../core/services/auth.service';
import { Store } from '@ngrx/store';
import { Post } from '../../models';
import { Observable, Subscription } from 'rxjs';
import { selectIsAuthenticated } from '../../core/store/Auth/auth.selectors';
import { SideNavComponent } from '../../components/side-nav/side-nav.component';

@Component({
  selector: 'app-bookmarks',
  templateUrl: './bookmarks.component.html',
  styleUrls: ['./bookmarks.component.scss'],
  standalone: true,
  imports: [CommonModule, PostCardComponent],
})
export class BookmarksComponent implements OnInit, OnDestroy {
  savedPosts: Post[] = [];
  isLoading = true;
  error?: string;
  isSidebarCollapsed = false;
  isLoggedIn$: Observable<boolean>;

  private authSubscription?: Subscription;
  private sidebarSubscription?: Subscription;

  constructor(
    private sideNavService: SideNavService,
    private authService: AuthService,
    private postService: PostService,
    private store: Store,
    private router: Router
  ) {
    this.isLoggedIn$ = this.store.select(selectIsAuthenticated);
  }

  ngOnInit(): void {
    // Subscribe to sidebar collapse state
    this.sidebarSubscription = this.sideNavService.sidebarState.subscribe(
      (isCollapsed) => {
        this.isSidebarCollapsed = isCollapsed;
      }
    );

    // Check if user is authenticated
    this.authSubscription = this.isLoggedIn$.subscribe((isLoggedIn) => {
      if (isLoggedIn) {
        this.loadSavedPosts();
      } else {
        // Redirect to sign-in page if not authenticated
        this.router.navigate(['/signin']);
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }

    if (this.sidebarSubscription) {
      this.sidebarSubscription.unsubscribe();
    }
  }

  loadSavedPosts(): void {
    const userId = this.authService.user?.id;
    if (!userId) {
      this.error = 'You must be logged in to view bookmarks';
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.error = undefined;

    this.postService.getSavedPosts(userId).subscribe({
      next: (posts) => {
        this.savedPosts = posts;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading bookmarks:', err);
        this.error = 'Failed to load bookmarks. Please try again later.';
        this.isLoading = false;
      },
    });
  }

  handlePostDeleted(postId: string): void {
    // Remove the deleted post from the list
    this.savedPosts = this.savedPosts.filter((post) => post.id !== postId);
  }

  handleUnsavedPost(postId: string): void {
    // Remove the unsaved post from the list
    this.savedPosts = this.savedPosts.filter((post) => post.id !== postId);
  }
}
