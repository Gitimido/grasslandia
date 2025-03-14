// src/app/pages/profile/profile.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserService } from '../../core/services/user.service';
import { PostService } from '../../core/services/post.service';
import { AuthService } from '../../core/services/auth.service';
import {
  FriendshipService,
  FriendshipStatus,
} from '../../core/services/friendship.service';
import { User, Post } from '../../models';
import { SideNavComponent } from '../../components/side-nav/side-nav.component';
import { CreatePostComponent } from '../../components/create-post/create-post.component';
import { PostCardComponent } from '../../components/post-card/post-card.component';
import { FeedStyle } from '../../components/feed/feed-styles.enum';
import { SideNavService } from '../../core/services/side-nav.service';
import { Observable, of, switchMap, finalize } from 'rxjs';

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

  // Expose FriendshipStatus enum to the template
  FriendshipStatus = FriendshipStatus;

  // Friend relationship properties
  friendshipStatus: FriendshipStatus | null = null;
  friendshipId: string | null = null;
  isInitiator = false;
  isFriendActionLoading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private postService: PostService,
    public authService: AuthService, // Changed to public so it can be accessed in the template
    private friendshipService: FriendshipService,
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

            // Check friendship status if not current user
            if (!this.isCurrentUser && this.authService.isAuthenticated()) {
              this.checkFriendshipStatus(user.id);
            }
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

  /**
   * Check friendship status with the profile user
   */
  checkFriendshipStatus(userId: string): void {
    this.friendshipService.getFriendshipStatus(userId).subscribe({
      next: (result) => {
        if (result) {
          this.friendshipStatus = result.status;
          this.friendshipId = result.id;
          this.isInitiator = result.initiatedByMe;
        } else {
          this.friendshipStatus = null;
          this.friendshipId = null;
        }
      },
      error: (err) => {
        console.error('Error checking friendship status:', err);
      },
    });
  }

  /**
   * Send a friend request to the profile user
   */
  sendFriendRequest(): void {
    if (!this.profile || !this.profile.id || this.isFriendActionLoading) {
      return;
    }

    this.isFriendActionLoading = true;
    this.friendshipService
      .sendFriendRequest(this.profile.id)
      .pipe(finalize(() => (this.isFriendActionLoading = false)))
      .subscribe({
        next: (friendship) => {
          this.friendshipStatus = FriendshipStatus.PENDING;
          this.friendshipId = friendship.id;
          this.isInitiator = true;
        },
        error: (err) => {
          console.error('Error sending friend request:', err);
        },
      });
  }

  /**
   * Accept a friend request from the profile user
   */
  acceptFriendRequest(): void {
    if (!this.friendshipId || this.isFriendActionLoading) {
      return;
    }

    this.isFriendActionLoading = true;
    this.friendshipService
      .acceptFriendRequest(this.friendshipId)
      .pipe(finalize(() => (this.isFriendActionLoading = false)))
      .subscribe({
        next: (friendship) => {
          this.friendshipStatus = FriendshipStatus.ACCEPTED;
        },
        error: (err) => {
          console.error('Error accepting friend request:', err);
        },
      });
  }

  /**
   * Reject a friend request from the profile user
   */
  rejectFriendRequest(): void {
    if (!this.friendshipId || this.isFriendActionLoading) {
      return;
    }

    this.isFriendActionLoading = true;
    this.friendshipService
      .rejectFriendRequest(this.friendshipId)
      .pipe(finalize(() => (this.isFriendActionLoading = false)))
      .subscribe({
        next: (friendship) => {
          this.friendshipStatus = FriendshipStatus.REJECTED;
        },
        error: (err) => {
          console.error('Error rejecting friend request:', err);
        },
      });
  }

  /**
   * Remove friendship with the profile user
   */
  removeFriendship(): void {
    if (!this.profile || !this.profile.id || this.isFriendActionLoading) {
      return;
    }

    this.isFriendActionLoading = true;
    this.friendshipService
      .removeFriendship(this.profile.id)
      .pipe(finalize(() => (this.isFriendActionLoading = false)))
      .subscribe({
        next: () => {
          this.friendshipStatus = null;
          this.friendshipId = null;
        },
        error: (err) => {
          console.error('Error removing friendship:', err);
        },
      });
  }

  /**
   * Get the display text for the friend button based on friendship status
   */
  getFriendButtonText(): string {
    switch (this.friendshipStatus) {
      case FriendshipStatus.PENDING:
        return this.isInitiator ? 'Friend Request Sent' : 'Respond to Request';
      case FriendshipStatus.ACCEPTED:
        return 'Friends';
      case FriendshipStatus.REJECTED:
        return 'Request Rejected';
      default:
        return 'Add Friend';
    }
  }

  /**
   * Get the class for the friend button based on friendship status
   */
  getFriendButtonClass(): string {
    switch (this.friendshipStatus) {
      case FriendshipStatus.PENDING:
        return this.isInitiator ? 'btn-disabled' : 'btn-primary';
      case FriendshipStatus.ACCEPTED:
        return 'btn-success';
      case FriendshipStatus.REJECTED:
        return 'btn-warning';
      default:
        return 'btn-primary';
    }
  }

  /**
   * Handle friend button click based on current friendship status
   */
  onFriendButtonClick(): void {
    if (this.isFriendActionLoading) return;

    switch (this.friendshipStatus) {
      case FriendshipStatus.PENDING:
        if (!this.isInitiator) {
          // Show the friend request response options
          // This will be handled in the template with a dropdown
        }
        break;
      case FriendshipStatus.ACCEPTED:
        if (confirm('Are you sure you want to remove this friend?')) {
          this.removeFriendship();
        }
        break;
      case null:
        this.sendFriendRequest();
        break;
    }
  }
}
