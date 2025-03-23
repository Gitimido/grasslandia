// src/app/components/side-nav/side-nav.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ViewChildren,
  QueryList,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterModule,
  Router,
  NavigationStart,
  NavigationEnd,
} from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SideNavService } from '../../core/services/side-nav.service';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { SearchPopupComponent } from '../search-popup/search-popup.component';
import { Subscription, filter } from 'rxjs';
import { UserService } from '../../core/services/user.service';
import { User } from '../../models/user.model';
import { gsap } from 'gsap';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, SearchPopupComponent],
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.scss'],
})
export class SideNavComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('logoText') logoTextRef!: ElementRef;
  @ViewChild('logoIcon') logoIconRef!: ElementRef;
  @ViewChildren('letterElement') letterElements!: QueryList<ElementRef>;
  @ViewChild('svgElement') svgElement!: ElementRef;
  @ViewChild('movingPoint') movingPoint!: ElementRef;

  // Add this property to store logo characters
  logoChars = ['G', 'R', 'A', 'S', 'S', 'L', 'A', 'N', 'D', 'I', 'A'];

  currentUser: SupabaseUser | null = null;
  userProfile: User | null = null;
  isCollapsed = true; // Start collapsed by default
  isHovered = false;
  isUserMenuOpen = false;
  isSearchOpen = false;
  forceCollapsed = false; // Use this to force collapse during navigation

  // Add this property to store the transition timeline
  private logoTransitionTimeline: gsap.core.Timeline | null = null;
  private userSubscription: Subscription | null = null;
  private profileSubscription: Subscription | null = null;
  private routerSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private sideNavService: SideNavService,
    private userService: UserService,
    private router: Router,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.userSubscription = this.authService.user$.subscribe((user) => {
      this.currentUser = user;

      if (user) {
        this.loadUserProfile();
      } else {
        this.userProfile = null;
      }
    });

    // Set initial collapsed state
    this.sideNavService.setSidebarState(this.isCollapsed);

    // Subscribe to router events to handle navigation state
    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        // Force collapse during navigation
        this.forceCollapsed = true;
        this.isCollapsed = true;
        this.sideNavService.setSidebarState(true);
      } else if (event instanceof NavigationEnd) {
        // Reset after navigation completes
        setTimeout(() => {
          this.forceCollapsed = false;
        }, 100);
      }
    });
  }

  ngAfterViewInit(): void {
    // Initialize GSAP animations
    setTimeout(() => {
      this.initLogoAnimations();

      // Make sure SVG elements are available
      if (this.svgElement && this.movingPoint) {
        console.log('SVG mouse tracking initialized');
      }
    }, 100);
  }

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
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  onMouseEnter(): void {
    // Don't expand if we're forcing collapse during navigation
    if (this.forceCollapsed) return;

    this.isHovered = true;
    if (this.isCollapsed) {
      this.toggleCollapse(false);
    }
  }

  onMouseLeave(): void {
    this.isHovered = false;
    this.toggleCollapse(true);
    this.isUserMenuOpen = false;
  }

  // Override the existing method to include animation
  toggleCollapse(state: boolean): void {
    // Skip animation if already in the target state
    if (this.isCollapsed === state) return;

    this.isCollapsed = state;
    this.sideNavService.setSidebarState(this.isCollapsed);

    // Run the transition animation
    if (this.logoTransitionTimeline) {
      if (state) {
        // Collapsing
        this.logoTransitionTimeline.play();
      } else {
        // Expanding
        this.logoTransitionTimeline.reverse();
      }
    }
  }

  toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;
  }

  closeSearch(): void {
    this.isSearchOpen = false;
  }

  handleSearch(query: string): void {
    // Navigate to search results page with the query
    this.router.navigate(['/search'], { queryParams: { q: query } });
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  signOut(): void {
    this.authService.signOut().subscribe();
    this.isUserMenuOpen = false;
  }

  // Initialize all logo animations
  initLogoAnimations(): void {
    this.setupLetterAnimations();
    this.setupLogoIconAnimation();
    this.setupLogoTransitionAnimations();
  }

  // Setup individual letter hover animations
  setupLetterAnimations(): void {
    if (this.letterElements) {
      this.letterElements.forEach((letterRef) => {
        const letterElement = letterRef.nativeElement;

        // Create a timeline for each letter
        const timeline = gsap.timeline({ paused: true });

        // Animation: only this letter jumps up and bounces back
        timeline
          .to(letterElement, {
            duration: 0.2,
            y: -15,
            ease: 'power2.out',
          })
          .to(letterElement, {
            duration: 0.3,
            y: 0,
            ease: 'elastic.out(1.2, 0.5)',
          });

        // Add mouse events to each letter
        letterElement.addEventListener('mouseenter', () => {
          timeline.restart();
        });
      });
    }
  }

  // Setup logo icon animations
  setupLogoIconAnimation(): void {}

  // Setup animations for transitioning between expanded and collapsed states
  setupLogoTransitionAnimations(): void {}

  hasAvatar(): boolean {
    return !!this.userProfile?.avatarUrl;
  }

  getUserAvatar(): string {
    return this.userProfile?.avatarUrl || '/assets/default-avatar.png';
  }

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
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    // Only track mouse if we have the required elements
    if (this.svgElement && this.movingPoint) {
      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate relative position in the viewport (0 to 1)
      const relativeX = event.clientX / viewportWidth;
      const relativeY = event.clientY / viewportHeight;

      // Map to SVG coordinate space (keeping within the circle)
      // Calculate the center point for the transform
      const svgX = relativeX * 70 + 15;
      const svgY = relativeY * 70 + 15;

      // Update the position of the sphere group using transform
      this.movingPoint.nativeElement.setAttribute(
        'transform',
        `translate(${svgX},${svgY})`
      );
    }
  }

  private calculatePosition(mouseX: number, mouseY: number) {
    const rect = this.svgElement.nativeElement.getBoundingClientRect();

    // Calculate relative position (0 to 1)
    const relativeX = (mouseX - rect.left) / rect.width;
    const relativeY = (mouseY - rect.top) / rect.height;

    // Map to SVG coordinate space (15 to 85 to keep within the inner circle)
    const svgX = 15 + relativeX * 70;
    const svgY = 15 + relativeY * 70;

    return { x: svgX, y: svgY };
  }

  openSettings(tab: 'profile' | 'appearance' | 'account' = 'profile'): void {
    this.settingsService.openSettings(tab);
  }
}
