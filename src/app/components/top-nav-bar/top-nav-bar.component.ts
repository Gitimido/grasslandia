// src/app/components/top-nav-bar/top-nav-bar.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  FriendshipService,
  FriendshipStatus,
  Friendship,
} from '../../core/services/friendship.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin, map, Subscription } from 'rxjs';
import { Notification } from '../../models';
import { UserService } from '../../core/services/user.service';

interface FriendItem {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  status: FriendshipStatus;
  timestamp?: Date;
}

@Component({
  selector: 'app-top-nav-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './top-nav-bar.component.html',
  styleUrls: ['./top-nav-bar.component.scss'],
})
export class TopNavBarComponent implements OnInit, OnDestroy {
  // States for the dropdowns
  isFriendsDropdownOpen = false;
  isNotificationsDropdownOpen = false;

  // Selected tab in friends dropdown
  activeFriendsTab: 'requests' | 'friends' = 'requests';

  // Data for friends and notifications
  friendRequests: FriendItem[] = [];
  currentFriends: FriendItem[] = [];
  notifications: Notification[] = [];

  // Counters
  friendRequestCount = 0;
  notificationCount = 0;

  // Loading states
  isFriendsLoading = true;
  isNotificationsLoading = true;
  actionLoading: { [key: string]: boolean } = {};

  // Subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private friendshipService: FriendshipService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Only setup subscriptions if user is logged in
    if (this.authService.isAuthenticated()) {
      // Subscribe to pending friend requests
      this.subscriptions.push(
        this.friendshipService.pendingFriendRequests$.subscribe((requests) => {
          this.friendRequests = requests.map((req) => ({
            id: req.id,
            username: req.users?.username || 'User',
            fullName: req.users?.full_name || '',
            avatarUrl: req.users?.avatar_url,
            status: req.status,
            timestamp: new Date(req.created_at),
          }));
          this.friendRequestCount = this.friendRequests.length;
          this.isFriendsLoading = false;
        })
      );

      // Subscribe to current friends - UPDATED VERSION
      this.subscriptions.push(
        this.friendshipService.friends$.subscribe((friendIds) => {
          this.isFriendsLoading = true;

          // If there are no friends, set empty array and finish
          if (!friendIds || friendIds.length === 0) {
            this.currentFriends = [];
            this.isFriendsLoading = false;
            return;
          }

          // Create an array of observables for each friend
          const friendObservables = friendIds.map((id) =>
            this.userService.getUserById(id).pipe(
              map((user) => {
                if (!user) {
                  // If user not found, return placeholder
                  return {
                    id,
                    username: 'Unknown User',
                    fullName: 'Unknown',
                    avatarUrl: undefined,
                    status: FriendshipStatus.ACCEPTED,
                  };
                }

                // Map user to FriendItem format
                return {
                  id: user.id,
                  username: user.username,
                  fullName: user.fullName,
                  avatarUrl: user.avatarUrl,
                  status: FriendshipStatus.ACCEPTED,
                };
              })
            )
          );

          // Wait for all friend lookups to complete
          forkJoin(friendObservables).subscribe({
            next: (friends) => {
              this.currentFriends = friends;
              this.isFriendsLoading = false;
            },
            error: (err) => {
              console.error('Error loading friends:', err);
              this.isFriendsLoading = false;

              // On error, still attempt to display some data with placeholders
              this.currentFriends = friendIds.map((id) => ({
                id,
                username: 'friend_' + id.substring(0, 5),
                fullName: 'Friend User',
                status: FriendshipStatus.ACCEPTED,
              }));
            },
          });
        })
      );

      // Subscribe to notifications
      this.subscriptions.push(
        this.notificationService.notifications$.subscribe((notifications) => {
          this.notifications = notifications;
          this.isNotificationsLoading = false;
        })
      );

      // Subscribe to unread notification count
      this.subscriptions.push(
        this.notificationService.unreadCount$.subscribe((count) => {
          this.notificationCount = count;
        })
      );
    }
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
  }

  // Toggle dropdown visibility
  toggleFriendsDropdown(): void {
    this.isFriendsDropdownOpen = !this.isFriendsDropdownOpen;
    if (this.isFriendsDropdownOpen) {
      this.isNotificationsDropdownOpen = false; // Close the other dropdown
    }
  }

  toggleNotificationsDropdown(): void {
    this.isNotificationsDropdownOpen = !this.isNotificationsDropdownOpen;
    if (this.isNotificationsDropdownOpen) {
      this.isFriendsDropdownOpen = false; // Close the other dropdown
    }
  }

  // Switch between tabs in the friends dropdown
  setActiveTab(tab: 'requests' | 'friends'): void {
    this.activeFriendsTab = tab;
  }

  acceptFriendRequest(requestId: string): void {
    this.actionLoading[requestId] = true;

    this.friendshipService.acceptFriendRequest(requestId).subscribe({
      next: () => {
        // The operation was successful - we'll let the real-time updates
        // handle removing the item from the list
        this.actionLoading[requestId] = false;

        // To ensure immediate UI update, find and remove the request
        const request = this.friendRequests.find((r) => r.id === requestId);
        if (request) {
          this.friendRequests = this.friendRequests.filter(
            (r) => r.id !== requestId
          );
          this.friendRequestCount = this.friendRequests.length;

          // Add to friends list
          this.currentFriends.push({
            id: request.id,
            username: request.username,
            fullName: request.fullName,
            avatarUrl: request.avatarUrl,
            status: FriendshipStatus.ACCEPTED,
          });
        }
      },
      error: (err) => {
        console.error('Error accepting friend request:', err);
        this.actionLoading[requestId] = false;
      },
    });
  }

  rejectFriendRequest(requestId: string): void {
    this.actionLoading[requestId] = true;

    this.friendshipService.rejectFriendRequest(requestId).subscribe({
      next: () => {
        this.actionLoading[requestId] = false;

        // Immediately remove the request from the UI
        this.friendRequests = this.friendRequests.filter(
          (r) => r.id !== requestId
        );
        this.friendRequestCount = this.friendRequests.length;
      },
      error: (err) => {
        console.error('Error rejecting friend request:', err);
        this.actionLoading[requestId] = false;
      },
    });
  }

  // Mark notification as read
  markNotificationAsRead(notificationId: string): void {
    this.notificationService.markAsRead(notificationId).subscribe({
      error: (err) => {
        console.error('Error marking notification as read:', err);
      },
    });
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const friendsDropdown = document.querySelector('.friends-dropdown');
    const friendsToggle = document.querySelector('.friend-toggle');
    const notificationsDropdown = document.querySelector(
      '.notifications-dropdown'
    );
    const notificationsToggle = document.querySelector('.notification-toggle');

    if (
      this.isFriendsDropdownOpen &&
      friendsDropdown &&
      friendsToggle &&
      !friendsDropdown.contains(event.target as Node) &&
      !friendsToggle.contains(event.target as Node)
    ) {
      this.isFriendsDropdownOpen = false;
    }

    if (
      this.isNotificationsDropdownOpen &&
      notificationsDropdown &&
      notificationsToggle &&
      !notificationsDropdown.contains(event.target as Node) &&
      !notificationsToggle.contains(event.target as Node)
    ) {
      this.isNotificationsDropdownOpen = false;
    }
  }

  // Format timestamp to relative time (e.g., "2h ago")
  formatTimeAgo(date: Date): string {
    // Same time calculation as other models
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + 'y';

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + 'mo';

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + 'd';

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + 'h';

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + 'm';

    return Math.floor(seconds) + 's';
  }

  getActorAvatar(notification: Notification): string {
    // Check for proper actor object structure
    if (notification.actor) {
      // Try user model format first (camelCase)
      if (notification.actor.avatarUrl) {
        return notification.actor.avatarUrl;
      }
      // Try database format (snake_case)
      if (notification.actor.avatar_url) {
        return notification.actor.avatar_url;
      }
    }
    // Default avatar
    return '/assets/default-avatar.png';
  }

  // And a similar method for username:
  getActorUsername(notification: Notification): string {
    if (notification.actor) {
      return (
        notification.actor.username || notification.actor.userName || 'User'
      );
    }
    return 'User';
  }
}
