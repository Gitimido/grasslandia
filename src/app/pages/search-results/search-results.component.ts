import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SideNavComponent } from '../../components/side-nav/side-nav.component';
import { SideNavService } from '../../core/services/side-nav.service';
import { SearchService } from '../../core/services/search.service';
import { PostCardComponent } from '../../components/post-card/post-card.component';
import { PostService } from '../../core/services/post.service';
import { CommentsSectionComponent } from '../../components/comments-section/comments-section.component';
import { Post, User } from '../../models';
import {
  Observable,
  Subscription,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  forkJoin,
} from 'rxjs';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    SideNavComponent,
    PostCardComponent,
    CommentsSectionComponent,
  ],
  template: `
    <app-side-nav></app-side-nav>

    <div
      class="search-results-container"
      [class.sidebar-collapsed]="isSidebarCollapsed"
    >
      <!-- Selected Post Detail View -->
      <div *ngIf="selectedPost" class="post-detail-view">
        <div class="detail-header">
          <button class="back-btn" (click)="closePostDetail()">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
            >
              <path
                d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                fill="currentColor"
              />
            </svg>
            Back to search results
          </button>
        </div>

        <div class="detail-content">
          <app-post-card
            [post]="selectedPost"
            (deleted)="handlePostDeleted($event)"
          ></app-post-card>

          <!-- Comments Section -->
          <div class="comments-container">
            <app-comments-section
              [postId]="selectedPost.id"
            ></app-comments-section>
          </div>
        </div>
      </div>

      <!-- Regular Search View -->
      <div *ngIf="!selectedPost">
        <div class="search-header">
          <div class="search-form">
            <form [formGroup]="searchForm" (ngSubmit)="onSubmit()">
              <div class="search-input-container">
                <span class="search-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                  >
                    <path
                      d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  formControlName="query"
                  class="search-input"
                  placeholder="Search Grasslandia..."
                  autofocus
                />
                <button type="submit" class="search-btn">Search</button>
              </div>
            </form>
          </div>
        </div>

        <div class="search-content">
          <div class="search-filters">
            <div class="filter-section">
              <h3>Filter Results</h3>
              <div class="filter-options">
                <button
                  class="filter-btn"
                  [class.active]="activeFilter === 'all'"
                  (click)="setFilter('all')"
                >
                  All Results
                </button>
                <button
                  class="filter-btn"
                  [class.active]="activeFilter === 'posts'"
                  (click)="setFilter('posts')"
                >
                  Posts
                </button>
                <button
                  class="filter-btn"
                  [class.active]="activeFilter === 'people'"
                  (click)="setFilter('people')"
                >
                  People
                </button>
              </div>
            </div>
          </div>

          <div class="results-area">
            <!-- Loading State -->
            <div *ngIf="isLoading" class="loading-state">
              <div class="spinner"></div>
              <p>Searching...</p>
            </div>

            <!-- Error State -->
            <div *ngIf="error" class="error-state">
              <p>{{ error }}</p>
              <button (click)="onSubmit()" class="retry-btn">Try Again</button>
            </div>

            <!-- Empty State -->
            <div *ngIf="!isLoading && !error && noResults" class="empty-state">
              <p>No results found for "{{ searchQuery }}"</p>
              <p class="empty-suggestions">
                Try using different keywords or checking your spelling.
              </p>
            </div>

            <!-- Results -->
            <div
              *ngIf="!isLoading && !error && !noResults"
              class="results-list"
            >
              <!-- People Section -->
              <div
                *ngIf="
                  (activeFilter === 'all' || activeFilter === 'people') &&
                  users.length > 0
                "
                class="results-section"
              >
                <h2 *ngIf="activeFilter === 'all'">People</h2>

                <div class="people-results">
                  <div
                    *ngFor="let user of users"
                    class="person-card"
                    [routerLink]="['/profile', user.username]"
                  >
                    <div class="person-avatar">
                      <img
                        [src]="user.avatarUrl || '/assets/default-avatar.png'"
                        [alt]="user.fullName || user.username"
                      />
                    </div>
                    <div class="person-info">
                      <h3 class="person-name">
                        {{ user.fullName || user.username }}
                      </h3>
                      <p class="person-username">{{ user.username }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Post Section -->
              <div
                *ngIf="
                  (activeFilter === 'all' || activeFilter === 'posts') &&
                  posts.length > 0
                "
                class="results-section"
              >
                <h2 *ngIf="activeFilter === 'all'">Posts</h2>

                <div class="posts-results">
                  <div
                    *ngFor="let post of posts"
                    class="post-result-item"
                    (click)="viewPostDetail(post)"
                  >
                    <app-post-card
                      [post]="post"
                      (deleted)="handlePostDeleted($event)"
                    ></app-post-card>
                  </div>
                </div>
              </div>

              <!-- Load More Button -->
              <div *ngIf="canLoadMore" class="load-more-container">
                <button
                  (click)="loadMore()"
                  class="load-more-btn"
                  [disabled]="isLoadingMore"
                >
                  <span *ngIf="!isLoadingMore">Load More Results</span>
                  <span *ngIf="isLoadingMore" class="loading-spinner-sm"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .search-results-container {
        margin-left: 250px; /* Match the sidebar width */
        min-height: 100vh;
        background-color: #f7f9fa;
        transition: margin-left 0.3s ease;
        display: flex;
        flex-direction: column;
      }

      .search-results-container.sidebar-collapsed {
        margin-left: 68px; /* Match the collapsed sidebar width */
      }

      .search-header {
        background-color: white;
        padding: 16px 24px;
        border-bottom: 1px solid #e4e6eb;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .search-input-container {
        display: flex;
        align-items: center;
        background-color: #f0f2f5;
        border-radius: 20px;
        padding: 8px 12px;
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
      }

      .search-icon {
        display: flex;
        align-items: center;
        color: #65676b;
        margin-right: 8px;
      }

      .search-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 15px;
        outline: none;
        padding: 4px 0;
      }

      .search-btn {
        background-color: #4a90e2;
        color: white;
        border: none;
        border-radius: 20px;
        padding: 6px 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .search-btn:hover {
        background-color: #3a7bc8;
      }

      .search-content {
        display: flex;
        padding: 24px;
        gap: 24px;
        flex: 1;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
      }

      .search-filters {
        width: 250px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        height: fit-content;
      }

      .filter-section {
        padding: 16px;
      }

      .filter-section h3 {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 12px;
        color: #1c1e21;
      }

      .filter-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .filter-btn {
        background-color: transparent;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        text-align: left;
        font-size: 14px;
        color: #65676b;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .filter-btn:hover {
        background-color: #f0f2f5;
      }

      .filter-btn.active {
        background-color: #e6f2ff;
        color: #1877f2;
        font-weight: 500;
      }

      .results-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .results-section {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        padding: 16px;
        margin-bottom: 16px;
      }

      .results-section h2 {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #1c1e21;
      }

      .people-results {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
      }

      .person-card {
        background-color: #f7f9fa;
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .person-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .person-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        overflow: hidden;
        margin-bottom: 12px;
      }

      .person-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .person-info {
        text-align: center;
        width: 100%;
      }

      .person-name {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 4px;
        color: #1c1e21;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .person-username {
        font-size: 13px;
        color: #65676b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .posts-results {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .post-result-item {
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .post-result-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .loading-state,
      .error-state,
      .empty-state {
        padding: 40px;
        text-align: center;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      .loading-state .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #4a90e2;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      .loading-state p {
        font-size: 16px;
        color: #65676b;
      }

      .error-state p {
        font-size: 16px;
        color: #e74c3c;
        margin-bottom: 16px;
      }

      .retry-btn {
        background-color: #e74c3c;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .retry-btn:hover {
        background-color: #c0392b;
      }

      .empty-state p {
        font-size: 16px;
        color: #1c1e21;
        margin-bottom: 8px;
      }

      .empty-suggestions {
        font-size: 14px;
        color: #65676b;
      }

      .load-more-container {
        display: flex;
        justify-content: center;
        margin-top: 16px;
        margin-bottom: 32px;
      }

      .load-more-btn {
        background-color: #f0f2f5;
        color: #1c1e21;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .load-more-btn:hover {
        background-color: #e4e6eb;
      }

      .load-more-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .loading-spinner-sm {
        width: 16px;
        height: 16px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #4a90e2;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      /* Post detail view styles */
      .post-detail-view {
        max-width: 800px;
        margin: 0 auto;
        padding: 24px;
        width: 100%;
      }

      .detail-header {
        margin-bottom: 16px;
      }

      .back-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        background-color: #f0f2f5;
        border: none;
        border-radius: 20px;
        padding: 8px 16px;
        font-size: 14px;
        color: #1c1e21;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .back-btn:hover {
        background-color: #e4e6eb;
      }

      .detail-content {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      .comments-container {
        padding: 16px;
        border-top: 1px solid #e4e6eb;
      }

      @media (max-width: 768px) {
        .search-results-container {
          margin-left: 68px;
        }

        .search-content {
          flex-direction: column;
          padding: 16px;
        }

        .search-filters {
          width: 100%;
          margin-bottom: 16px;
        }

        .people-results {
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        }

        .post-detail-view {
          padding: 16px;
        }
      }
    `,
  ],
})
export class SearchResultsComponent implements OnInit, OnDestroy {
  searchForm: FormGroup;
  searchQuery: string = '';
  activeFilter: 'all' | 'posts' | 'people' = 'all';

  posts: Post[] = [];
  users: User[] = [];
  selectedPost: Post | null = null;

  isLoading: boolean = false;
  isLoadingMore: boolean = false;
  error: string | null = null;

  isSidebarCollapsed: boolean = false;

  private offset: number = 0;
  private limit: number = 10;
  canLoadMore: boolean = false;

  private routeSubscription: Subscription | null = null;
  private sidebarSubscription: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private sideNavService: SideNavService,
    private searchService: SearchService,
    private postService: PostService
  ) {
    this.searchForm = this.fb.group({
      query: [''],
    });
  }

  ngOnInit(): void {
    // Monitor sidebar state
    this.sidebarSubscription = this.sideNavService.sidebarState.subscribe(
      (isCollapsed) => {
        this.isSidebarCollapsed = isCollapsed;
      }
    );

    // Watch for query parameter changes
    this.routeSubscription = this.route.queryParams.subscribe((params) => {
      const query = params['q'];
      const postId = params['postId'];

      // If we have a post ID, load the post
      if (postId) {
        this.loadPostDetail(postId);
      } else if (query) {
        // Otherwise, perform a search
        this.searchQuery = query;
        this.searchForm.get('query')?.setValue(query);
        this.offset = 0;
        this.selectedPost = null; // Clear any selected post
        this.performSearch(query);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }

    if (this.sidebarSubscription) {
      this.sidebarSubscription.unsubscribe();
    }
  }

  // Load a specific post
  loadPostDetail(postId: string): void {
    this.isLoading = true;
    this.selectedPost = null;

    this.postService.getPost(postId).subscribe({
      next: (post) => {
        this.selectedPost = post;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading post:', err);
        this.error =
          'Failed to load the post. It may have been deleted or is unavailable.';
        this.isLoading = false;
      },
    });
  }

  // Show post detail view
  viewPostDetail(post: Post): void {
    // Update URL without reloading
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { postId: post.id },
      queryParamsHandling: 'merge',
    });
  }

  // Return to search results view
  closePostDetail(): void {
    // Remove postId from URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { postId: null },
      queryParamsHandling: 'merge',
    });

    this.selectedPost = null;
  }

  // Submit the search form
  onSubmit(): void {
    const query = this.searchForm.get('query')?.value;
    if (query && query.trim()) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { q: query, postId: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  // Set the active filter
  setFilter(filter: 'all' | 'posts' | 'people'): void {
    if (this.activeFilter !== filter) {
      this.activeFilter = filter;

      // Reset pagination when filter changes
      this.offset = 0;
    }
  }

  // Perform the search based on query and active filter
  performSearch(query: string): void {
    this.isLoading = true;
    this.error = null;
    this.posts = [];
    this.users = [];

    // Create observables for both search types
    const userSearch$ = this.searchService.searchUsers(query, 20);
    const postSearch$ = this.searchService.searchPosts(
      query,
      this.limit,
      this.offset
    );

    // Use forkJoin to run both searches in parallel
    forkJoin({
      users: userSearch$,
      posts: postSearch$,
    }).subscribe({
      next: (results) => {
        this.users = results.users;
        this.posts = results.posts;

        // Determine if we can load more posts
        this.canLoadMore = results.posts.length >= this.limit;

        // Update offset for next page
        this.offset = this.posts.length;

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error searching:', err);
        this.error = 'An error occurred while searching. Please try again.';
        this.isLoading = false;
      },
    });
  }

  // Load more results (pagination)
  loadMore(): void {
    if (this.isLoadingMore) return;

    this.isLoadingMore = true;

    // Only load more posts (users are loaded all at once)
    this.searchService
      .searchPosts(this.searchQuery, this.limit, this.offset)
      .subscribe({
        next: (morePosts) => {
          // Add new posts to existing array
          this.posts = [...this.posts, ...morePosts];

          // Determine if we can load more
          this.canLoadMore = morePosts.length >= this.limit;

          // Update offset for next page
          this.offset = this.posts.length;

          this.isLoadingMore = false;
        },
        error: (err) => {
          console.error('Error loading more results:', err);
          this.isLoadingMore = false;
        },
      });
  }

  // Handle deleted posts
  handlePostDeleted(postId: string): void {
    // If the deleted post is currently selected
    if (this.selectedPost && this.selectedPost.id === postId) {
      this.closePostDetail();
    }

    // Remove from posts list
    this.posts = this.posts.filter((post) => post.id !== postId);
  }

  // Check if there are no results
  get noResults(): boolean {
    if (this.activeFilter === 'all') {
      return this.posts.length === 0 && this.users.length === 0;
    } else if (this.activeFilter === 'posts') {
      return this.posts.length === 0;
    } else {
      // 'people'
      return this.users.length === 0;
    }
  }
}
