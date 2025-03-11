// src/app/components/side-nav/side-nav.component.ts
import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SideNavService } from '../../core/services/side-nav.service';
import { User } from '@supabase/supabase-js';
import { SearchPopupComponent } from '../search-popup/search-popup.component';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, SearchPopupComponent],
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.scss'],
})
export class SideNavComponent implements OnInit {
  currentUser: User | null = null;
  isCollapsed = false;
  isUserMenuOpen = false;
  isSearchOpen = false;
  notificationCount = 0; // Sample notification count

  constructor(
    private authService: AuthService,
    private sideNavService: SideNavService
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe((user) => {
      this.currentUser = user;
    });

    // Subscribe to sidebar state
    this.sideNavService.sidebarState.subscribe((state) => {
      this.isCollapsed = state;
    });
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
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
