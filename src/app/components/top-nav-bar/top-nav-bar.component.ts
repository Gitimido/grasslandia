// src/app/components/top-nav-bar/top-nav-bar.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  FriendshipService,
  FriendshipStatus,
} from '../../core/services/friendship.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { Subscription, interval } from 'rxjs';
import { Notification } from '../../models';

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
  private checkCountsSubscription?: Subscription;

  constructor(
    private friendshipService: FriendshipService,
    private notificationService: NotificationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Only start polling for counts if user is logged in
    if (this.authService.isAuthenticated()) {
      this.startPeriodicChecks();
    }
  }

  ngOnDestroy(): void {
    this.stopPeriodicChecks();
  }

  // Toggle dropdown visibility
  toggleFriendsDropdown(): void {
    this.isFriendsDropdownOpen = !this.isFriendsDropdownOpen;
    if (this.isFriendsDropdownOpen) {
      this.isNotificationsDropdownOpen = false; // Close the other dropdown
      this.loadFriendRequests();
      this.loadFriends();
    }
  }

  toggleNotificationsDropdown(): void {
    this.isNotificationsDropdownOpen = !this.isNotificationsDropdownOpen;
    if (this.isNotificationsDropdownOpen) {
      this.isFriendsDropdownOpen = false; // Close the other dropdown
      this.loadNotifications();
    }
  }

  // Switch between tabs in the friends dropdown
  setActiveTab(tab: 'requests' | 'friends'): void {
    this.activeFriendsTab = tab;
  }

  // Load friend requests
  loadFriendRequests(): void {
    this.isFriendsLoading = true;
    this.friendshipService.getPendingFriendRequests().subscribe({
      next: (requests) => {
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
      },
      error: (err) => {
        console.error('Error loading friend requests:', err);
        this.isFriendsLoading = false;
      },
    });
  }

  // Load current friends
  loadFriends(): void {
    this.isFriendsLoading = true;
    this.friendshipService.getFriends().subscribe({
      next: (friendIds) => {
        // For now just create placeholder objects with IDs
        // In a real implementation, you'd fetch user details for each friend
        this.currentFriends = friendIds.map((id) => ({
          id,
          username: 'friend_' + id.substring(0, 5),
          fullName: 'Friend User',
          status: FriendshipStatus.ACCEPTED,
        }));
        this.isFriendsLoading = false;
      },
      error: (err) => {
        console.error('Error loading friends:', err);
        this.isFriendsLoading = false;
      },
    });
  }

  // Load notifications
  loadNotifications(): void {
    this.isNotificationsLoading = true;
    this.notificationService.getNotifications(10, 0).subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.notificationCount = notifications.filter((n) => !n.read).length;
        this.isNotificationsLoading = false;
      },
      error: (err) => {
        console.error('Error loading notifications:', err);
        this.isNotificationsLoading = false;
      },
    });
  }

  // Accept a friend request
  acceptFriendRequest(requestId: string): void {
    this.actionLoading[requestId] = true;

    this.friendshipService.acceptFriendRequest(requestId).subscribe({
      next: () => {
        // Remove from requests and add to friends
        const acceptedRequest = this.friendRequests.find(
          (req) => req.id === requestId
        );
        if (acceptedRequest) {
          acceptedRequest.status = FriendshipStatus.ACCEPTED;
          this.currentFriends.push(acceptedRequest);
          this.friendRequests = this.friendRequests.filter(
            (req) => req.id !== requestId
          );
          this.friendRequestCount = this.friendRequests.length;
        }
        this.actionLoading[requestId] = false;
      },
      error: (err) => {
        console.error('Error accepting friend request:', err);
        this.actionLoading[requestId] = false;
      },
    });
  }

  // Reject a friend request
  rejectFriendRequest(requestId: string): void {
    this.actionLoading[requestId] = true;

    this.friendshipService.rejectFriendRequest(requestId).subscribe({
      next: () => {
        // Remove from requests
        this.friendRequests = this.friendRequests.filter(
          (req) => req.id !== requestId
        );
        this.friendRequestCount = this.friendRequests.length;
        this.actionLoading[requestId] = false;
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
      next: () => {
        // Update notification in the list
        const notification = this.notifications.find(
          (n) => n.id === notificationId
        );
        if (notification) {
          notification.read = true;
          this.notificationCount = this.notifications.filter(
            (n) => !n.read
          ).length;
        }
      },
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
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays}d ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
  }

  private startPeriodicChecks(): void {
    // Stop any existing subscription
    this.stopPeriodicChecks();

    // Check counts every 30 seconds
    this.checkCountsSubscription = interval(30000).subscribe(() => {
      this.checkCounts();
    });

    // Initial check
    this.checkCounts();
  }

  private stopPeriodicChecks(): void {
    if (this.checkCountsSubscription) {
      this.checkCountsSubscription.unsubscribe();
      this.checkCountsSubscription = undefined;
    }
  }

  private checkCounts(): void {
    // Check notifications
    this.notificationService.getUnreadCount().subscribe((count) => {
      this.notificationCount = count;
    });

    // Check friend requests
    this.friendshipService.getPendingFriendRequests().subscribe((requests) => {
      this.friendRequestCount = requests.length;
    });
  }
}
