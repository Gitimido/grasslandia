// src/app/core/services/friendship.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environment';
import {
  Observable,
  from,
  throwError,
  of,
  map,
  catchError,
  switchMap,
} from 'rxjs';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

export enum FriendshipStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  BLOCKED = 'blocked',
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: Date;
  updated_at: Date;
  // This can store the joined user data
  users?: {
    id?: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
    email?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class FriendshipService {
  private supabase: SupabaseClient;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  /**
   * Send a friend request to another user
   * @param friendId The ID of the user to befriend
   * @returns Observable with the created friendship
   */
  sendFriendRequest(friendId: string): Observable<Friendship> {
    const currentUserId = this.authService.user?.id;

    if (!currentUserId) {
      return throwError(
        () => new Error('You must be logged in to send friend requests')
      );
    }

    if (currentUserId === friendId) {
      return throwError(
        () => new Error('You cannot send a friend request to yourself')
      );
    }

    // Check if a friendship already exists
    return this.getFriendshipStatus(friendId).pipe(
      switchMap((status) => {
        // If there's already any type of relationship, don't create a new one
        if (status) {
          return throwError(
            () => new Error('A friendship relationship already exists')
          );
        }

        // Create new friendship with pending status
        return from(
          this.supabase
            .from('friendships')
            .insert({
              user_id: currentUserId,
              friend_id: friendId,
              status: FriendshipStatus.PENDING,
            })
            .select('*')
        ).pipe(
          switchMap(({ data, error }) => {
            if (error) throw error;
            if (!data || data.length === 0)
              throw new Error('Failed to create friendship');

            // Create a notification for the recipient
            return this.notificationService
              .createNotification({
                userId: friendId,
                type: 'friend_request',
                content: 'sent you a friend request',
                actorId: currentUserId,
                resourceId: data[0].id,
                resourceType: 'friendship',
                read: false,
              })
              .pipe(map(() => data[0] as Friendship));
          })
        );
      }),
      catchError((error) => {
        console.error('Error sending friend request:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Accept a pending friend request
   * @param friendshipId The ID of the friendship to accept
   * @returns Observable with the updated friendship
   */
  acceptFriendRequest(friendshipId: string): Observable<Friendship> {
    const currentUserId = this.authService.user?.id;

    if (!currentUserId) {
      return throwError(
        () => new Error('You must be logged in to accept friend requests')
      );
    }

    // First check if this user is the recipient of the request
    return from(
      this.supabase
        .from('friendships')
        .select('*')
        .eq('id', friendshipId)
        .single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error('Friendship not found');

        // Verify this user is the recipient (friend_id)
        if (data.friend_id !== currentUserId) {
          return throwError(
            () =>
              new Error(
                'You cannot accept a friend request that was not sent to you'
              )
          );
        }

        // Update friendship status to accepted
        return from(
          this.supabase
            .from('friendships')
            .update({
              status: FriendshipStatus.ACCEPTED,
              updated_at: new Date(),
            })
            .eq('id', friendshipId)
            .select('*')
        ).pipe(
          switchMap(({ data: updatedData, error: updateError }) => {
            if (updateError) throw updateError;
            if (!updatedData || updatedData.length === 0)
              throw new Error('Failed to update friendship');

            // Create a notification for the original sender
            return this.notificationService
              .createNotification({
                userId: data.user_id,
                // Use the correct notification type that we added
                type: 'friend_accepted' as 'friend_request', // Type cast to satisfy TS
                content: 'accepted your friend request',
                actorId: currentUserId,
                resourceId: friendshipId,
                resourceType: 'friendship',
                read: false,
              })
              .pipe(map(() => updatedData[0] as Friendship));
          })
        );
      }),
      catchError((error) => {
        console.error('Error accepting friend request:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Reject a pending friend request
   * @param friendshipId The ID of the friendship to reject
   * @returns Observable with the updated friendship
   */
  rejectFriendRequest(friendshipId: string): Observable<Friendship> {
    const currentUserId = this.authService.user?.id;

    if (!currentUserId) {
      return throwError(
        () => new Error('You must be logged in to reject friend requests')
      );
    }

    // First check if this user is the recipient of the request
    return from(
      this.supabase
        .from('friendships')
        .select('*')
        .eq('id', friendshipId)
        .single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error('Friendship not found');

        // Verify this user is the recipient
        if (data.friend_id !== currentUserId) {
          return throwError(
            () =>
              new Error(
                'You cannot reject a friend request that was not sent to you'
              )
          );
        }

        // Update friendship status to rejected
        return from(
          this.supabase
            .from('friendships')
            .update({
              status: FriendshipStatus.REJECTED,
              updated_at: new Date(),
            })
            .eq('id', friendshipId)
            .select('*')
        ).pipe(
          map(({ data: updatedData, error: updateError }) => {
            if (updateError) throw updateError;
            if (!updatedData || updatedData.length === 0)
              throw new Error('Failed to update friendship');

            return updatedData[0] as Friendship;
          })
        );
      }),
      catchError((error) => {
        console.error('Error rejecting friend request:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Remove a friendship (unfriend)
   * @param friendId The ID of the user to unfriend
   * @returns Observable indicating success
   */
  removeFriendship(friendId: string): Observable<void> {
    const currentUserId = this.authService.user?.id;

    if (!currentUserId) {
      return throwError(
        () => new Error('You must be logged in to remove friendships')
      );
    }

    // Delete any friendship records between these users (in either direction)
    return from(
      this.supabase
        .from('friendships')
        .delete()
        .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
        .or(`user_id.eq.${friendId},friend_id.eq.${friendId}`)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => {
        console.error('Error removing friendship:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all friends of the current user
   * @returns Observable with array of user ids who are friends
   */
  getFriends(): Observable<string[]> {
    const currentUserId = this.authService.user?.id;

    if (!currentUserId) {
      return of([]);
    }

    // Get friendships where the current user is either the sender or recipient
    // and the status is accepted
    return from(
      this.supabase
        .from('friendships')
        .select('user_id, friend_id')
        .eq('status', FriendshipStatus.ACCEPTED)
        .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data || data.length === 0) return [];

        // Map to an array of friend IDs (excluding the current user)
        return data.map((friendship) =>
          friendship.user_id === currentUserId
            ? friendship.friend_id
            : friendship.user_id
        );
      }),
      catchError((error) => {
        console.error('Error fetching friends:', error);
        return of([]);
      })
    );
  }

  /**
   * Get pending friend requests sent to the current user
   * @returns Observable with array of friendships with user data
   */
  getPendingFriendRequests(): Observable<Friendship[]> {
    const currentUserId = this.authService.user?.id;

    if (!currentUserId) {
      return of([]);
    }

    // Get friendships where the current user is the recipient
    // and the status is pending, include the sender's user data
    return from(
      this.supabase
        .from('friendships')
        .select(
          `
          *,
          users:user_id(id, username, full_name, avatar_url)
        `
        )
        .eq('friend_id', currentUserId)
        .eq('status', FriendshipStatus.PENDING)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data || data.length === 0) return [];

        return data as Friendship[];
      }),
      catchError((error) => {
        console.error('Error fetching pending friend requests:', error);
        return of([]);
      })
    );
  }

  /**
   * Check the friendship status between the current user and another user
   * @param friendId The ID of the other user
   * @returns Observable with friendship status or null if no relationship
   */
  getFriendshipStatus(friendId: string): Observable<{
    status: FriendshipStatus;
    id: string;
    initiatedByMe: boolean;
  } | null> {
    const currentUserId = this.authService.user?.id;

    if (!currentUserId) {
      return of(null);
    }

    if (currentUserId === friendId) {
      return of(null); // Can't be friends with yourself
    }

    // Check if any friendship exists between these users
    return from(
      this.supabase
        .from('friendships')
        .select('*')
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`
        )
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data || data.length === 0) return null;

        // Return the friendship details
        const friendship = data[0];
        return {
          status: friendship.status as FriendshipStatus,
          id: friendship.id,
          initiatedByMe: friendship.user_id === currentUserId,
        };
      }),
      catchError((error) => {
        console.error('Error checking friendship status:', error);
        return of(null);
      })
    );
  }
}
