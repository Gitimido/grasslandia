// src/app/components/friend-requests/friend-requests.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  FriendshipService,
  FriendshipStatus,
} from '../../core/services/friendship.service';
import { finalize } from 'rxjs';

// Define a proper interface for the friendship with user data
interface FriendshipWithUser {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: Date;
  updated_at: Date;
  users?: {
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

@Component({
  selector: 'app-friend-requests',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './friend-requests.component.html',
  styleUrls: ['./friend-requests.component.scss'],
})
export class FriendRequestsComponent implements OnInit {
  requests: FriendshipWithUser[] = [];
  isLoading = true;
  actionLoading: { [key: string]: boolean } = {};

  constructor(private friendshipService: FriendshipService) {}

  ngOnInit(): void {
    this.loadFriendRequests();
  }

  // Format username with @ symbol
  formatUsername(username?: string): string {
    if (!username) return '@username';
    return '@' + username;
  }

  loadFriendRequests(): void {
    this.isLoading = true;
    this.friendshipService.getPendingFriendRequests().subscribe({
      next: (requests) => {
        // Cast to our interface that includes user data
        this.requests = requests as unknown as FriendshipWithUser[];
        this.isLoading = false;

        // Initialize action loading state for each request
        this.requests.forEach((req) => {
          this.actionLoading[req.id] = false;
        });
      },
      error: (err) => {
        console.error('Error loading friend requests:', err);
        this.isLoading = false;
      },
    });
  }

  acceptRequest(requestId: string): void {
    this.actionLoading[requestId] = true;

    this.friendshipService
      .acceptFriendRequest(requestId)
      .pipe(finalize(() => (this.actionLoading[requestId] = false)))
      .subscribe({
        next: () => {
          // Remove the request from the list
          this.requests = this.requests.filter((req) => req.id !== requestId);
        },
        error: (err) => {
          console.error('Error accepting friend request:', err);
        },
      });
  }

  rejectRequest(requestId: string): void {
    this.actionLoading[requestId] = true;

    this.friendshipService
      .rejectFriendRequest(requestId)
      .pipe(finalize(() => (this.actionLoading[requestId] = false)))
      .subscribe({
        next: () => {
          // Remove the request from the list
          this.requests = this.requests.filter((req) => req.id !== requestId);
        },
        error: (err) => {
          console.error('Error rejecting friend request:', err);
        },
      });
  }
}
