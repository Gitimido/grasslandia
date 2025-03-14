// src/app/pages/profile/profile.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserService } from '../../core/services/user.service';
import { PostService } from '../../core/services/post.service';
import { AuthService } from '../../core/services/auth.service';
import { User, Post } from '../../models';
import { SideNavComponent } from '../../components/side-nav/side-nav.component';
import { CreatePostComponent } from '../../components/create-post/create-post.component';
import { FeedComponent } from '../../components/feed/feed.component';
import { PostCardComponent } from '../../components/post-card/post-card.component';
import { FeedStyle } from '../../components/feed/feed-styles.enum';
import { SideNavService } from '../../core/services/side-nav.service';
import { Observable, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SideNavComponent,
    PostCardComponent,
    CreatePostComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  profile: User | null = null;
  posts: Post[] = [];
  feedStyle = FeedStyle.PROFILE;
  isLoading = true;
  isError = false;
  isCurrentUser = false;
  isSidebarCollapsed = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private postService: PostService,
    private authService: AuthService,
    private sideNavService: SideNavService
  ) {}

  ngOnInit(): void {
    // Track sidebar state
    this.sideNavService.sidebarState.subscribe((state) => {
      this.isSidebarCollapsed = state;
    });

    // Get username from route params
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const username = params.get('username');

          if (!username) {
            return of(null);
          }

          if (username === 'me') {
            // If 'me', use current user
            this.isCurrentUser = true;
            return this.userService.getCurrentUserProfile();
          } else {
            // Otherwise look up user by username
            return this.userService.getUserByUsername(username).pipe(
              switchMap((user) => {
                if (user) {
                  // Check if this is the current user
                  this.isCurrentUser = this.authService.user?.id === user.id;
                  return of(user);
                } else {
                  // User not found
                  this.router.navigate(['/']);
                  return of(null);
                }
              })
            );
          }
        })
      )
      .subscribe({
        next: (user) => {
          this.profile = user;
          if (user) {
            this.loadUserPosts(user.username);
          } else {
            this.isLoading = false;
          }
        },
        error: (err) => {
          console.error('Error loading profile:', err);
          this.isLoading = false;
          this.isError = true;
        },
      });
  }

  loadUserPosts(username: string): void {
    this.postService.getPostsByUsername(username).subscribe({
      next: (posts) => {
        this.posts = posts;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading posts:', err);
        this.isLoading = false;
        this.isError = true;
      },
    });
  }

  handlePostCreated(post: Post): void {
    // Refresh the posts when a new post is created
    if (this.profile) {
      this.loadUserPosts(this.profile.username);
    }
  }
}
