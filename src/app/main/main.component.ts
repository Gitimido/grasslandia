// src/app/main/main.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { selectIsAuthenticated } from '../core/store/Auth/auth.selectors';
import { SideNavComponent } from '../components/side-nav/side-nav.component';
import { TopNavBarComponent } from '../components/top-nav-bar/top-nav-bar.component';
import { SideNavService } from '../core/services/side-nav.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SideNavComponent, TopNavBarComponent],
  template: `
    <div class="app-wrapper">
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
        background-color: #f0f4f8; /* Consistent background color for entire app */
        position: relative;
      }

      .main-content {
        padding: 24px;
        transition: padding-left 0.3s ease;
        min-height: 100vh;
        box-sizing: border-box;
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
export class MainComponent implements OnInit {
  isAuthenticated$: Observable<boolean>;
  isSidebarCollapsed = true; // Default state

  constructor(private store: Store, private sideNavService: SideNavService) {
    this.isAuthenticated$ = this.store.select(selectIsAuthenticated);
  }

  ngOnInit(): void {
    // Subscribe to sidebar state
    this.sideNavService.sidebarState.subscribe((state) => {
      this.isSidebarCollapsed = state;
    });
  }
}
