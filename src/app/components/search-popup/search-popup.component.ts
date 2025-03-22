import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
} from 'rxjs';
import {
  SearchService,
  SearchResult,
} from '../../core/services/search.service';
@Component({
  selector: 'app-search-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div
      class="search-overlay"
      [class.fade-out]="isClosing"
      *ngIf="isVisible"
      (click)="closePopup($event)"
    >
      <div
        class="search-popup"
        [class.slide-up]="isClosing"
        (click)="$event.stopPropagation()"
      >
        <div class="search-header">
          <div class="search-input-container">
            <span class="search-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="20"
                height="20"
              >
                <path
                  d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <input
              type="text"
              class="search-input"
              placeholder="Search Grasslandia..."
              [(ngModel)]="searchTerm"
              (input)="onSearchInput()"
              (keydown.enter)="performSearch()"
              #searchInput
              autofocus
            />
            <button
              *ngIf="searchTerm"
              class="clear-button"
              (click)="clearSearch()"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="18"
                height="18"
              >
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>

        <div class="search-results" *ngIf="searchTerm">
          <!-- Loading state -->
          <div class="loading-state" *ngIf="isLoading">
            <div class="spinner"></div>
            <span>Searching...</span>
          </div>

          <!-- No results -->
          <div
            class="search-section"
            *ngIf="!isLoading && searchResults.length === 0"
          >
            <div class="no-results">
              <p>No results found for "{{ searchTerm }}"</p>
              <button (click)="performSearch()" class="search-all-btn">
                Search for posts with this term
              </button>
            </div>
          </div>

          <!-- Results shown when search returns items -->
          <div
            class="search-section"
            *ngIf="!isLoading && searchResults.length > 0"
          >
            <div
              class="result-item"
              *ngFor="let result of searchResults"
              (click)="navigateToResult(result)"
            >
              <div class="result-icon" [ngClass]="result.type">
                <ng-container *ngIf="result.type === 'user'">
                  <img
                    *ngIf="result.imageUrl"
                    [src]="result.imageUrl"
                    [alt]="result.title"
                    class="user-avatar"
                  />
                  <svg
                    *ngIf="!result.imageUrl"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                  >
                    <path
                      d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                      fill="currentColor"
                    />
                  </svg>
                </ng-container>
                <svg
                  *ngIf="result.type === 'post'"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                >
                  <path
                    d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div class="result-details">
                <div class="result-name">{{ result.title }}</div>
                <div class="result-meta">{{ result.subtitle }}</div>
                <div *ngIf="result.content" class="result-content">
                  {{ result.content | slice : 0 : 80
                  }}{{ result.content.length > 80 ? '...' : '' }}
                </div>
              </div>
            </div>

            <!-- View all results button -->
            <div class="view-all-container">
              <button class="view-all-btn" (click)="performSearch()">
                See all results for "{{ searchTerm }}"
              </button>
            </div>
          </div>
        </div>

        <div class="search-results" *ngIf="!searchTerm">
          <div class="search-section">
            <div class="section-header">
              <span>Recent Searches</span>
              <button class="clear-all" (click)="clearRecentSearches()">
                Clear All
              </button>
            </div>
            <div class="recent-searches">
              <div *ngIf="recentSearches.length === 0" class="no-history">
                <p>No recent searches</p>
              </div>
              <div *ngIf="recentSearches.length > 0" class="recent-list">
                <div
                  *ngFor="let search of recentSearches"
                  class="recent-item"
                  (click)="selectRecentSearch(search)"
                >
                  <span class="recent-icon">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                    >
                      <path
                        d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                  <span class="recent-text">{{ search }}</span>
                  <button
                    class="remove-recent"
                    (click)="removeRecentSearch($event, search)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                    >
                      <path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .search-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        justify-content: center;
        animation: fade-in 0.2s ease;
      }

      .fade-out {
        animation: fade-out 0.2s ease forwards;
      }

      @keyframes fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes fade-out {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }

      .search-popup {
        position: absolute;
        top: 12px;
        width: 90%;
        max-width: 600px;
        background-color: var(--card-background);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-dropdown);
        overflow: hidden;
        animation: slide-down 0.3s ease;
        border: 1px solid var(--border-color);
      }

      .slide-up {
        animation: slide-up 0.2s ease forwards;
      }

      @keyframes slide-down {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes slide-up {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(-20px);
        }
      }

      .search-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color);
      }

      .search-input-container {
        display: flex;
        align-items: center;
        background-color: var(--hover-color);
        border-radius: var(--radius-full);
        padding: 8px 12px;
        transition: all var(--transition-fast);
        border: 1px solid transparent;

        &:focus-within {
          background-color: var(--card-background);
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
        }
      }

      .search-icon {
        display: flex;
        align-items: center;
        color: var(--text-color);
        opacity: 0.7;
        margin-right: 8px;
      }

      .search-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 15px;
        outline: none;
        color: var(--text-color);

        &::placeholder {
          color: var(--text-color);
          opacity: 0.5;
        }
      }

      .clear-button {
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        color: var(--text-color);
        opacity: 0.7;
        cursor: pointer;
        width: 24px;
        height: 24px;
        border-radius: var(--radius-full);
        transition: all var(--transition-fast);

        &:hover {
          background-color: var(--secondary-color);
          opacity: 1;
        }
      }

      .search-results {
        max-height: 500px;
        overflow-y: auto;
      }

      .search-section {
        padding: 8px 0;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 16px;
        font-size: 15px;
        font-weight: 600;
        color: var(--text-color);

        .clear-all {
          background: none;
          border: none;
          color: var(--primary-color);
          font-size: 13px;
          cursor: pointer;
          transition: all var(--transition-fast);

          &:hover {
            text-decoration: underline;
            opacity: 0.9;
          }
        }
      }

      .no-history,
      .no-results {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 20px 0;
        color: var(--text-color);
        opacity: 0.7;
        font-size: 14px;
      }

      .search-all-btn,
      .view-all-btn {
        margin-top: 12px;
        background-color: var(--hover-color);
        border: none;
        border-radius: var(--radius-md);
        padding: 8px 12px;
        font-size: 14px;
        color: var(--primary-color);
        cursor: pointer;
        font-weight: 500;
        transition: all var(--transition-fast);

        &:hover {
          background-color: var(--secondary-color);
          transform: translateY(-1px);
        }
      }

      .result-item {
        display: flex;
        align-items: center;
        padding: 10px 16px;
        cursor: pointer;
        transition: all var(--transition-fast);

        &:hover {
          background-color: var(--hover-color);
          transform: translateX(4px);
        }
      }

      .result-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-full);
        margin-right: 12px;
        background-color: var(--hover-color);
        color: var(--text-color);
        overflow: hidden;

        &.user {
          background-color: var(--secondary-color);
          color: var(--primary-color);
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          object-fit: cover;
        }

        &.post {
          background-color: var(--secondary-color);
          color: var(--primary-color);
        }
      }

      .result-details {
        flex: 1;
      }

      .result-name {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-color);
      }

      .result-meta {
        font-size: 13px;
        color: var(--text-color);
        opacity: 0.7;
      }

      .result-content {
        font-size: 13px;
        color: var(--text-color);
        opacity: 0.7;
        margin-top: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 24px 0;

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--hover-color);
          border-top: 2px solid var(--primary-color);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 12px;
        }

        span {
          color: var(--text-color);
          opacity: 0.7;
          font-size: 14px;
        }
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      .view-all-container {
        text-align: center;
        padding: 12px 0;
        border-top: 1px solid var(--border-color);
      }

      .recent-list {
        padding: 0 16px;
      }

      .recent-item {
        display: flex;
        align-items: center;
        padding: 10px 0;
        cursor: pointer;
        transition: all var(--transition-fast);

        &:hover {
          background-color: var(--hover-color);
          transform: translateX(4px);
        }

        .recent-icon {
          display: flex;
          align-items: center;
          color: var(--text-color);
          opacity: 0.7;
          margin-right: 12px;
        }

        .recent-text {
          flex: 1;
          font-size: 14px;
          color: var(--text-color);
        }

        .remove-recent {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: var(--text-color);
          opacity: 0.7;
          cursor: pointer;
          width: 24px;
          height: 24px;
          border-radius: var(--radius-full);
          transition: all var(--transition-fast);

          &:hover {
            background-color: var(--hover-color);
            opacity: 1;
            color: var(--error-color);
          }
        }
      }
    `,
  ],
})
export class SearchPopupComponent implements AfterViewInit {
  @Input() isOpen: boolean = false;
  @Output() closeRequested = new EventEmitter<void>();
  @Output() search = new EventEmitter<string>();

  @ViewChild('searchInput') searchInput!: ElementRef;

  searchTerm: string = '';
  searchResults: SearchResult[] = [];
  isLoading: boolean = false;
  recentSearches: string[] = [];

  // Add these properties for controlling the animations
  isVisible: boolean = false;
  isClosing: boolean = false;

  // Create a subject for debounced search
  private searchTerms = new Subject<string>();

  constructor(private searchService: SearchService, private router: Router) {
    // Load recent searches from localStorage
    this.loadRecentSearches();

    // Setup debounced search for typeahead
    this.searchTerms
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (term.length < 2) {
            return of([]);
          }
          this.isLoading = true;
          return this.searchService.searchAll(term, 5);
        })
      )
      .subscribe({
        next: (results) => {
          this.searchResults = results;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error searching:', error);
          this.isLoading = false;
        },
      });
  }

  ngAfterViewInit() {
    this.focusInput();
  }

  ngOnChanges() {
    if (this.isOpen && !this.isVisible) {
      // Opening the popup
      this.isVisible = true;
      this.isClosing = false;
      setTimeout(() => this.focusInput(), 100);
    } else if (!this.isOpen && this.isVisible) {
      // Closing the popup with animation
      this.isClosing = true;
      setTimeout(() => {
        this.isVisible = false;
        this.isClosing = false;
      }, 200); // Match with CSS animation duration
    }
  }

  focusInput() {
    if (this.isOpen && this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.focus();
    }
  }

  closePopup(event: MouseEvent) {
    // Close popup when clicking outside
    if (event.target === event.currentTarget) {
      this.isClosing = true;

      // Wait for the animation to complete before emitting close
      setTimeout(() => {
        this.closeRequested.emit();
      }, 200);
    }
  }

  onSearchInput() {
    // Send the search term to the debounced observable
    if (this.searchTerm && this.searchTerm.length >= 2) {
      this.searchTerms.next(this.searchTerm);
    } else {
      this.searchResults = [];
    }
  }

  performSearch() {
    if (!this.searchTerm || this.searchTerm.length < 2) return;

    // Add to recent searches
    this.addToRecentSearches(this.searchTerm);

    // Emit the search event
    this.search.emit(this.searchTerm);

    // Navigate to search results page
    this.router.navigate(['/search'], {
      queryParams: { q: this.searchTerm },
    });

    // Close the popup
    this.closeRequested.emit();
  }

  navigateToResult(result: SearchResult) {
    console.log('Navigating to result:', result);

    if (result.type === 'user') {
      // For user results, keep navigating to profile pages
      const username = result.subtitle?.replace('@', '');
      console.log('Navigating to user profile:', username);
      this.router.navigate(['/profile', username]);
    } else if (result.type === 'post') {
      // For post results, navigate to search page with post ID parameter
      console.log('Navigating to search with post:', result.id);
      this.router.navigate(['/search'], {
        queryParams: {
          postId: result.id,
        },
      });
    }

    // Close the popup after navigation
    this.closeRequested.emit();
  }

  clearSearch() {
    this.searchTerm = '';
    this.searchResults = [];
  }

  // Recent searches management
  private loadRecentSearches() {
    const searches = localStorage.getItem('recentSearches');
    if (searches) {
      try {
        this.recentSearches = JSON.parse(searches);
      } catch (e) {
        this.recentSearches = [];
      }
    }
  }

  private saveRecentSearches() {
    localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
  }

  addToRecentSearches(search: string) {
    // Remove if already exists to avoid duplicates
    this.recentSearches = this.recentSearches.filter((s) => s !== search);

    // Add to the beginning
    this.recentSearches.unshift(search);

    // Limit to 10 recent searches
    if (this.recentSearches.length > 10) {
      this.recentSearches = this.recentSearches.slice(0, 10);
    }

    this.saveRecentSearches();
  }

  removeRecentSearch(event: Event, search: string) {
    event.stopPropagation();
    this.recentSearches = this.recentSearches.filter((s) => s !== search);
    this.saveRecentSearches();
  }

  clearRecentSearches() {
    this.recentSearches = [];
    this.saveRecentSearches();
  }

  selectRecentSearch(search: string) {
    this.searchTerm = search;
    this.performSearch();
  }
}
