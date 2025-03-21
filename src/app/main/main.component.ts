// src/app/main/main.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';
import { selectIsAuthenticated } from '../core/store/Auth/auth.selectors';
import { SideNavComponent } from '../components/side-nav/side-nav.component';
import { TopNavBarComponent } from '../components/top-nav-bar/top-nav-bar.component';
import { SideNavService } from '../core/services/side-nav.service';
import { ThemeService, ThemeOption } from '../core/services/theme.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SideNavComponent, TopNavBarComponent],
  template: `
    <div class="app-wrapper theme-transition" [ngClass]="currentThemeClass">
      <app-side-nav></app-side-nav>

      <ng-container *ngIf="isAuthenticated$ | async">
        <app-top-nav-bar></app-top-nav-bar>
      </ng-container>

      <div
        class="main-content"
        [ngClass]="{
          'sidebar-expanded': !isSidebarCollapsed,
          'sidebar-collapsed': isSidebarCollapsed
        }"
      >
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [
    `
      .app-wrapper {
        display: block;
        min-height: 100vh;
        width: 100%;
        position: relative;
        transition: background-color 0.3s ease;
        background-color: var(--background-color);
        color: var(--text-color);
      }

      .main-content {
        padding: 24px;
        transition: padding-left 0.3s ease, background-color 0.3s ease;
        min-height: 100vh;
        box-sizing: border-box;
        background-color: var(--background-color);
      }

      .sidebar-collapsed {
        padding-left: 84px; /* 68px for sidebar + some padding */
      }

      .sidebar-expanded {
        padding-left: 266px; /* 250px for sidebar + some padding */
      }

      @media (max-width: 768px) {
        .main-content {
          padding: 16px;
        }

        .sidebar-collapsed,
        .sidebar-expanded {
          padding-left: 84px; /* Always use collapsed size on mobile */
        }
      }
    `,
  ],
})
export class MainComponent implements OnInit, OnDestroy {
  isAuthenticated$: Observable<boolean>;
  isSidebarCollapsed = true; // Default state
  currentThemeClass = 'theme-light'; // Default theme class

  private themeSubscription: Subscription | null = null;
  private sidebarSubscription: Subscription | null = null;

  constructor(
    private store: Store,
    private sideNavService: SideNavService,
    private themeService: ThemeService
  ) {
    this.isAuthenticated$ = this.store.select(selectIsAuthenticated);
  }

  ngOnInit(): void {
    // Subscribe to sidebar state
    this.sidebarSubscription = this.sideNavService.sidebarState.subscribe(
      (state) => {
        this.isSidebarCollapsed = state;
      }
    );

    // Subscribe to theme changes
    this.themeSubscription = this.themeService.currentTheme$.subscribe(
      (theme) => {
        this.currentThemeClass = `theme-${theme}`;

        // Optional: You could log theme changes for debugging
        console.log('Theme changed to:', theme);
      }
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    if (this.sidebarSubscription) {
      this.sidebarSubscription.unsubscribe();
    }

    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }
}
