// src/app/components/auth-debug/auth-debug.component.ts
import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environment';

@Component({
  selector: 'app-auth-debug',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="debug-toggle"
      (click)="toggleDebugger()"
      [class.active]="isExpanded"
    >
      <div class="debug-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
        >
          <path
            d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"
            fill="currentColor"
          />
        </svg>
      </div>
      <span class="debug-label">Auth</span>
    </div>

    <div class="debug-panel" *ngIf="isExpanded" [class.show]="isExpanded">
      <div class="debug-header">
        <h3>Supabase Auth Debugger</h3>
        <button class="close-btn" (click)="toggleDebugger()">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
          >
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>

      <div class="debug-content">
        <div *ngIf="isLoading" class="loading-indicator">
          <div class="spinner"></div>
          <span>Checking authentication status...</span>
        </div>

        <div *ngIf="!isLoading">
          <div *ngIf="authError" class="error-message">
            <strong>Auth Error:</strong> {{ authError }}
          </div>

          <div
            class="auth-status"
            [class.authenticated]="user"
            [class.unauthenticated]="!user"
          >
            <div class="status-badge">
              <span *ngIf="user">✓</span>
              <span *ngIf="!user">✗</span>
            </div>
            <div class="status-text">
              <strong>Status:</strong>
              {{ user ? 'Authenticated' : 'Not Authenticated' }}
            </div>
          </div>

          <div *ngIf="user" class="user-info">
            <div class="info-row">
              <div class="info-label">User ID:</div>
              <div class="info-value">{{ user.id }}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Email:</div>
              <div class="info-value">{{ user.email }}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Created At:</div>
              <div class="info-value">{{ formatDate(user.created_at) }}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Last Sign In:</div>
              <div class="info-value">
                {{ formatDate(user.last_sign_in_at) }}
              </div>
            </div>
            <div class="info-row">
              <div class="info-label">Token Expiry:</div>
              <div class="info-value">{{ tokenExpiry }}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Provider:</div>
              <div class="info-value">
                {{ user.app_metadata?.provider || 'email' }}
              </div>
            </div>
            <div class="info-row">
              <div class="info-label">Role:</div>
              <div class="info-value">{{ getUserRole() }}</div>
            </div>
          </div>

          <div class="debug-actions">
            <button class="action-btn refresh" (click)="checkAuth()">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
              >
                <path
                  d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 9h7V2l-2.35 4.35z"
                  fill="currentColor"
                />
              </svg>
              Refresh Auth
            </button>
            <button class="action-btn test" (click)="runTest()">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
              >
                <path
                  d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2V9h-2V7h4v10z"
                  fill="currentColor"
                />
              </svg>
              Test DB Access
            </button>
          </div>

          <div
            *ngIf="testResult"
            class="test-result"
            [class.success]="testSuccess"
            [class.failure]="!testSuccess"
          >
            <div class="result-icon">
              <svg
                *ngIf="testSuccess"
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                  fill="currentColor"
                />
              </svg>
              <svg
                *ngIf="!testSuccess"
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
              >
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div class="result-text">{{ testResult }}</div>
          </div>
        </div>
      </div>

      <div class="debug-footer">
        <div class="connection-info">
          <div class="connection-dot" [class.connected]="isConnected"></div>
          <span>{{
            isConnected ? 'Connected to Supabase' : 'Disconnected'
          }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;

        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      }

      .debug-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #3ecf8e;
        color: white;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition: all 0.2s ease;
        border: 2px solid rgba(255, 255, 255, 0.2);
      }

      .debug-toggle:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }

      .debug-toggle.active {
        background-color: #38a169;
      }

      .debug-icon {
        width: 20px;
        height: 20px;
        margin-right: 6px;
      }

      .debug-label {
        font-size: 14px;
        font-weight: 600;
      }

      .debug-panel {
        position: absolute;
        top: 45px;
        left: 0;
        background-color: white;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        width: 380px;
        max-height: 85vh;
        overflow-y: auto;
        border: 1px solid #eaeaea;
        animation: slide-in 0.3s ease;
        transform-origin: top left;
        max-width: 90vw;
      }

      @keyframes slide-in {
        from {
          opacity: 0;
          transform: translateY(-10px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .debug-header {
        padding: 16px;
        background-color: #f9fafb;
        border-bottom: 1px solid #eaeaea;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 10px 10px 0 0;
      }

      .debug-header h3 {
        margin: 0;
        font-size: 16px;
        color: #111827;
      }

      .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #6b7280;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        border-radius: 4px;
      }

      .close-btn:hover {
        background-color: #f3f4f6;
        color: #111827;
      }

      .debug-content {
        padding: 16px;
      }

      .loading-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px 0;
        flex-direction: column;
        color: #6b7280;
      }

      .spinner {
        width: 24px;
        height: 24px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3ecf8e;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 12px;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      .error-message {
        padding: 12px;
        background-color: #fee2e2;
        color: #b91c1c;
        border-radius: 6px;
        margin-bottom: 16px;
        font-size: 14px;
        border-left: 3px solid #b91c1c;
      }

      .auth-status {
        display: flex;
        align-items: center;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 16px;
      }

      .auth-status.authenticated {
        background-color: #d1fae5;
      }

      .auth-status.unauthenticated {
        background-color: #fee2e2;
      }

      .status-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        margin-right: 12px;
        font-weight: bold;
      }

      .authenticated .status-badge {
        background-color: #10b981;
        color: white;
      }

      .unauthenticated .status-badge {
        background-color: #ef4444;
        color: white;
      }

      .status-text {
        font-size: 14px;
      }

      .authenticated .status-text {
        color: #047857;
      }

      .unauthenticated .status-text {
        color: #b91c1c;
      }

      .user-info {
        background-color: #f9fafb;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 16px;
      }

      .info-row {
        display: flex;
        padding: 8px 0;
        border-bottom: 1px solid #eaeaea;
      }

      .info-row:last-child {
        border-bottom: none;
      }

      .info-label {
        font-weight: 500;
        color: #4b5563;
        width: 100px;
        font-size: 13px;
      }

      .info-value {
        color: #111827;
        word-break: break-all;
        font-size: 13px;
      }

      .debug-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }

      .action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px 12px;
        border-radius: 6px;
        border: none;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .action-btn svg {
        margin-right: 6px;
      }

      .action-btn.refresh {
        background-color: #eff6ff;
        color: #1d4ed8;
      }

      .action-btn.refresh:hover {
        background-color: #dbeafe;
      }

      .action-btn.test {
        background-color: #f3f4f6;
        color: #4b5563;
      }

      .action-btn.test:hover {
        background-color: #e5e7eb;
      }

      .test-result {
        padding: 12px;
        border-radius: 6px;
        display: flex;
        align-items: flex-start;
        margin-bottom: 16px;
        font-size: 13px;
      }

      .result-icon {
        margin-right: 8px;
        margin-top: 2px;
      }

      .test-result.success {
        background-color: #d1fae5;
        color: #047857;
      }

      .test-result.failure {
        background-color: #fee2e2;
        color: #b91c1c;
      }

      .debug-footer {
        padding: 12px 16px;
        background-color: #f9fafb;
        border-top: 1px solid #eaeaea;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 0 0 10px 10px;
      }

      .connection-info {
        display: flex;
        align-items: center;
        font-size: 12px;
        color: #6b7280;
      }

      .connection-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 6px;
        background-color: #ef4444;
      }

      .connection-dot.connected {
        background-color: #10b981;
      }

      @media (max-width: 480px) {
        .debug-panel {
          width: 320px;
        }

        .debug-toggle {
          padding: 6px 10px;
        }

        .debug-icon {
          width: 18px;
          height: 18px;
        }

        .debug-label {
          font-size: 13px;
        }
      }
    `,
  ],
})
export class AuthDebugComponent implements OnInit {
  private supabase: SupabaseClient;
  isLoading = true;
  user: any = null;
  authError: string | null = null;
  tokenExpiry: string | null = null;
  testResult: string | null = null;
  testSuccess = false;
  isExpanded = false;
  isConnected = false;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  ngOnInit(): void {
    this.checkConnection();
    this.checkAuth();
  }

  toggleDebugger(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.checkAuth();
    }
  }

  // Close panel when clicking outside
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const debugToggle = document.querySelector('.debug-toggle');
    const debugPanel = document.querySelector('.debug-panel');

    if (this.isExpanded && debugToggle && debugPanel) {
      if (
        !debugToggle.contains(event.target as Node) &&
        !debugPanel.contains(event.target as Node)
      ) {
        this.isExpanded = false;
      }
    }
  }

  async checkConnection(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('posts')
        .select('count', { count: 'exact', head: true });
      this.isConnected = !error;
    } catch {
      this.isConnected = false;
    }
  }

  async checkAuth(): Promise<void> {
    this.isLoading = true;
    this.authError = null;
    this.testResult = null;

    try {
      const { data, error } = await this.supabase.auth.getSession();

      if (error) {
        this.authError = error.message;
        this.user = null;
      } else if (data && data.session) {
        this.user = data.session.user;

        // Calculate token expiry
        const jwt = data.session.access_token;
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        const expiryDate = new Date(payload.exp * 1000);
        this.tokenExpiry = expiryDate.toLocaleString();
      } else {
        this.user = null;
        this.authError = 'No active session found.';
      }
    } catch (err: any) {
      this.authError =
        err.message || 'An error occurred checking authentication.';
      this.user = null;
    } finally {
      this.isLoading = false;
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleString();
  }

  getUserRole(): string {
    if (!this.user) return 'N/A';

    if (this.user.app_metadata?.claims_admin) {
      return 'Admin';
    } else if (this.user.app_metadata?.roles) {
      return this.user.app_metadata.roles.join(', ');
    }

    return 'User';
  }

  async runTest(): Promise<void> {
    this.testResult = null;
    this.testSuccess = false;

    if (!this.user) {
      this.testResult = 'Cannot run test: Not authenticated.';
      return;
    }

    try {
      // Test 1: Try to insert a test post
      const { data: insertData, error: insertError } = await this.supabase
        .from('posts')
        .insert({
          user_id: this.user.id,
          content: 'Test post - please ignore',
          privacy_level: 'public',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('*');

      if (insertError) {
        this.testResult = `Insert test failed: ${insertError.message}`;
        return;
      }

      if (insertData && insertData.length > 0) {
        const postId = insertData[0].id;
        this.testResult = `Successfully created test post with ID: ${postId}`;
        this.testSuccess = true;

        // Clean up: Delete the test post
        await this.supabase.from('posts').delete().eq('id', postId);
      } else {
        this.testResult =
          'Insert appeared to succeed but no data was returned.';
      }
    } catch (err: any) {
      this.testResult = `Test error: ${err.message}`;
    }
  }
}
