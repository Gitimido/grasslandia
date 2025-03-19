// src/app/components/side-nav/side-nav.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SideNavService } from '../../core/services/side-nav.service';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { SearchPopupComponent } from '../search-popup/search-popup.component';
import { Subscription } from 'rxjs';
import { UserService } from '../../core/services/user.service';
import { User } from '../../models'; // Import your User model

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, SearchPopupComponent],
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.scss'],
})
export class SideNavComponent implements OnInit, OnDestroy {
  currentUser: SupabaseUser | null = null;
  userProfile: User | null = null; // Add this to store the user profile with avatar
  isCollapsed = true; // Start collapsed by default
  isHovered = false;
  isUserMenuOpen = false;
  isSearchOpen = false;

  private userSubscription: Subscription | null = null;
  private profileSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private sideNavService: SideNavService,
    private userService: UserService // Add user service
  ) {}

  ngOnInit(): void {
    this.userSubscription = this.authService.user$.subscribe((user) => {
      this.currentUser = user;

      // If user is logged in, fetch their profile
      if (user) {
        this.loadUserProfile();
      } else {
        this.userProfile = null;
      }
    });

    // Set initial collapsed state and inform the service
    this.sideNavService.setSidebarState(this.isCollapsed);
  }

  // New method to load user profile
  loadUserProfile(): void {
    this.profileSubscription = this.userService
      .getCurrentUserProfile()
      .subscribe({
        next: (profile) => {
          this.userProfile = profile;
        },
        error: (err) => {
          console.error('Error loading user profile:', err);
        },
      });
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.profileSubscription) {
      this.profileSubscription.unsubscribe();
    }
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

  // Updated to check for userProfile and return avatar or initial
  hasAvatar(): boolean {
    return !!this.userProfile?.avatarUrl;
  }

  getUserAvatar(): string {
    return this.userProfile?.avatarUrl || '/assets/default-avatar.png';
  }

  // Updated to get initial from user's name first, then email
  getUserInitial(): string {
    // First try to get it from user profile
    if (this.userProfile) {
      if (this.userProfile.fullName && this.userProfile.fullName.length > 0) {
        return this.userProfile.fullName.charAt(0).toUpperCase();
      }
      if (this.userProfile.username && this.userProfile.username.length > 0) {
        return this.userProfile.username.charAt(0).toUpperCase();
      }
    }

    // Fallback to auth user
    if (!this.currentUser) return '?';

    // Try to get from metadata
    if (this.currentUser.user_metadata?.['full_name']) {
      return this.currentUser.user_metadata['full_name']
        .charAt(0)
        .toUpperCase();
    }
    if (this.currentUser.user_metadata?.['username']) {
      return this.currentUser.user_metadata['username'].charAt(0).toUpperCase();
    }

    // Final fallback to email
    return (this.currentUser.email || '?').charAt(0).toUpperCase();
  }

  getUserDisplayName(): string {
    // First try user profile
    if (this.userProfile) {
      return this.userProfile.fullName || this.userProfile.username || 'User';
    }

    // Fallback to auth user
    if (!this.currentUser) return 'Guest';

    // Use metadata if available
    if (this.currentUser.user_metadata?.['full_name']) {
      return this.currentUser.user_metadata['full_name'];
    }
    if (this.currentUser.user_metadata?.['username']) {
      return this.currentUser.user_metadata['username'];
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
