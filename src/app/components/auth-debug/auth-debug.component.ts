// src/app/components/auth-debug/auth-debug.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environment';

@Component({
  selector: 'app-auth-debug',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="debug-container">
      <h3>Supabase Auth Debugger</h3>
      <div *ngIf="isLoading">Checking authentication status...</div>

      <div *ngIf="!isLoading">
        <div *ngIf="authError" class="error">
          <strong>Auth Error:</strong> {{ authError }}
        </div>

        <div *ngIf="user">
          <p><strong>✅ Authenticated:</strong> Yes</p>
          <p><strong>User ID:</strong> {{ user.id }}</p>
          <p><strong>Email:</strong> {{ user.email }}</p>
          <p><strong>Created At:</strong> {{ user.created_at }}</p>
          <p><strong>Token Expiry:</strong> {{ tokenExpiry }}</p>
        </div>

        <div *ngIf="!user">
          <p><strong>❌ Authenticated:</strong> No</p>
        </div>

        <div class="actions">
          <button (click)="checkAuth()">Refresh Auth Status</button>
          <button (click)="runTest()">Test Posts Table Access</button>
        </div>

        <div
          *ngIf="testResult"
          class="test-result"
          [class.success]="testSuccess"
          [class.failure]="!testSuccess"
        >
          <strong>Test Result:</strong> {{ testResult }}
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .debug-container {
        background-color: #f8f9fa;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      }

      h3 {
        margin-top: 0;
        margin-bottom: 16px;
      }

      .error {
        color: #dc3545;
        margin-bottom: 16px;
      }

      .actions {
        margin-top: 16px;
        margin-bottom: 16px;
      }

      button {
        background-color: #4a90e2;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        margin-right: 8px;
        cursor: pointer;
      }

      button:hover {
        background-color: #3a7bc8;
      }

      .test-result {
        padding: 12px;
        border-radius: 4px;
        margin-top: 16px;
      }

      .success {
        background-color: #d4edda;
        color: #155724;
      }

      .failure {
        background-color: #f8d7da;
        color: #721c24;
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

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  ngOnInit(): void {
    this.checkAuth();
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
        this.testResult = `✅ Successfully created test post with ID: ${postId}`;
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
