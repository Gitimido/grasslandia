// src/app/components/side-nav/side-nav.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SideNavService } from '../../core/services/side-nav.service';
import { FriendshipService } from '../../core/services/friendship.service';
import { NotificationService } from '../../core/services/notification.service';
import { User } from '@supabase/supabase-js';
import { SearchPopupComponent } from '../search-popup/search-popup.component';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, SearchPopupComponent],
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.scss'],
})
export class SideNavComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isCollapsed = true; // Start collapsed by default
  isHovered = false;
  isUserMenuOpen = false;
  isSearchOpen = false;
  notificationCount = 0;
  friendRequestCount = 0;

  private checkCountsSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private sideNavService: SideNavService,
    private friendshipService: FriendshipService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe((user) => {
      this.currentUser = user;

      if (user) {
        // If user is logged in, start periodic checks for notifications and friend requests
        this.startPeriodicChecks();
      } else {
        // If user logs out, stop checks and reset counts
        this.stopPeriodicChecks();
        this.notificationCount = 0;
        this.friendRequestCount = 0;
      }
    });

    // Set initial collapsed state and inform the service
    this.sideNavService.setSidebarState(this.isCollapsed);
  }

  ngOnDestroy(): void {
    this.stopPeriodicChecks();
  }

  private startPeriodicChecks(): void {
    // Stop any existing subscription
    this.stopPeriodicChecks();

    // Initial check immediately
    this.checkCounts();

    // Then check every 30 seconds
    this.checkCountsSubscription = interval(30000).subscribe(() => {
      this.checkCounts();
    });
  }

  private stopPeriodicChecks(): void {
    if (this.checkCountsSubscription) {
      this.checkCountsSubscription.unsubscribe();
      this.checkCountsSubscription = null;
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

  onMouseEnter(): void {
    this.isHovered = true;
    // Only expand if it was collapsed before
    if (this.isCollapsed) {
      this.toggleCollapse(false);
    }
  }

  onMouseLeave(): void {
    this.isHovered = false;
    // Collapse when mouse leaves and close user menu if open
    this.toggleCollapse(true);
    this.isUserMenuOpen = false;
  }

  toggleCollapse(state: boolean): void {
    this.isCollapsed = state;
    this.sideNavService.setSidebarState(this.isCollapsed);
  }

  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;
  }

  closeSearch(): void {
    this.isSearchOpen = false;
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  createNewPost(): void {
    // Placeholder for post creation functionality
    console.log('Create new post');
  }

  signOut(): void {
    this.authService.signOut().subscribe();
    this.isUserMenuOpen = false;
  }

  getUserInitial(): string {
    if (!this.currentUser || !this.currentUser.email) return '?';
    return this.currentUser.email.charAt(0).toUpperCase();
  }

  getUserDisplayName(): string {
    if (!this.currentUser) return 'Guest';

    // Use real username if available
    if (this.currentUser['user_metadata']?.['full_name']) {
      return this.currentUser['user_metadata']['full_name'];
    }

    // Fallback to email
    return this.currentUser.email || 'User';
  }

  // Close user menu when clicking outside
  @HostListener('document:click', ['$event'])
  closeUserMenuOnOutsideClick(event: Event): void {
    if (this.isUserMenuOpen) {
      const target = event.target as HTMLElement;
      const userInfo = document.querySelector('.user-info');
      const userMenu = document.querySelector('.user-menu');

      if (
        userInfo &&
        userMenu &&
        !userInfo.contains(target) &&
        !userMenu.contains(target)
      ) {
        this.isUserMenuOpen = false;
      }
    }
  }
}
