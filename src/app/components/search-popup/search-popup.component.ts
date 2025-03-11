// src/app/components/search-popup/search-popup.component.ts
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

@Component({
  selector: 'app-search-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
        <!-- Rest of your template remains the same -->
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
          <!-- Recent searches shown when search is empty -->
          <div class="search-section" *ngIf="searchResults.length === 0">
            <div class="no-results">
              <p>No results found for "{{ searchTerm }}"</p>
            </div>
          </div>

          <!-- Results shown when search returns items -->
          <div class="search-section" *ngIf="searchResults.length > 0">
            <div class="result-item" *ngFor="let result of searchResults">
              <div class="result-icon" [ngClass]="result.type">
                <svg
                  *ngIf="result.type === 'user'"
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
                <div class="result-name">{{ result.name }}</div>
                <div class="result-meta">{{ result.meta }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="search-results" *ngIf="!searchTerm">
          <div class="search-section">
            <div class="section-header">
              <span>Recent Searches</span>
              <button class="clear-all">Clear All</button>
            </div>
            <div class="no-history">
              <p>No recent searches</p>
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
        max-width: 500px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        animation: slide-down 0.3s ease;
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

      /* Rest of your styles remain the same */
      .search-header {
        padding: 12px 16px;
        border-bottom: 1px solid #e4e6eb;
      }

      .search-input-container {
        display: flex;
        align-items: center;
        background-color: #f0f2f5;
        border-radius: 20px;
        padding: 8px 12px;
      }

      .search-icon {
        display: flex;
        align-items: center;
        color: #65676b;
        margin-right: 8px;
      }

      .search-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 15px;
        outline: none;
      }

      .clear-button {
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        color: #65676b;
        cursor: pointer;
        width: 24px;
        height: 24px;
        border-radius: 50%;

        &:hover {
          background-color: #e4e6eb;
        }
      }

      .search-results {
        max-height: 400px;
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
        color: #65676b;

        .clear-all {
          background: none;
          border: none;
          color: #4a90e2;
          font-size: 13px;
          cursor: pointer;

          &:hover {
            text-decoration: underline;
          }
        }
      }

      .no-history,
      .no-results {
        display: flex;
        justify-content: center;
        padding: 20px 0;
        color: #65676b;
        font-size: 14px;
      }

      .result-item {
        display: flex;
        align-items: center;
        padding: 10px 16px;
        cursor: pointer;
        transition: background-color 0.2s ease;

        &:hover {
          background-color: #f0f2f5;
        }
      }

      .result-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        margin-right: 12px;
        background-color: #e4e6eb;
        color: #050505;

        &.user {
          background-color: #e1f5fe;
          color: #0288d1;
        }

        &.post {
          background-color: #e8f5e9;
          color: #388e3c;
        }
      }

      .result-details {
        flex: 1;
      }

      .result-name {
        font-size: 15px;
        font-weight: 500;
        color: #050505;
      }

      .result-meta {
        font-size: 13px;
        color: #65676b;
      }
    `,
  ],
})
export class SearchPopupComponent implements AfterViewInit {
  @Input() isOpen: boolean = false;
  @Output() closeRequested = new EventEmitter<void>();

  @ViewChild('searchInput') searchInput!: ElementRef;

  searchTerm: string = '';
  searchResults: any[] = [];

  // Add these properties for controlling the animations
  isVisible: boolean = false;
  isClosing: boolean = false;

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
    // Mock search functionality
    if (this.searchTerm.length > 2) {
      // Simulate API call delay
      setTimeout(() => {
        this.searchResults = [
          {
            type: 'user',
            name: 'John Doe',
            meta: 'Friend',
          },
          {
            type: 'post',
            name: 'Weekend Adventures',
            meta: '2 days ago',
          },
        ].filter((result) =>
          result.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
      }, 300);
    } else {
      this.searchResults = [];
    }
  }

  clearSearch() {
    this.searchTerm = '';
    this.searchResults = [];
  }
}
