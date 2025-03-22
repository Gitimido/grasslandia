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
  templateUrl: './search-results.component.html',
  styleUrls: ['./search-results.component.scss'],
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

  // ...rest of the component code remains the same

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
