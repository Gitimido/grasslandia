// src/app/core/services/friendship.service.ts
import { Injectable } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from '@supabase/supabase-js';
import { environment } from '../../../environment';
import {
  Observable,
  from,
  throwError,
  of,
  map,
  catchError,
  switchMap,
  BehaviorSubject,
  Subject,
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
  private friendRequestsSubscription: RealtimeChannel | null = null;
  private friendshipUpdatesSubscription: RealtimeChannel | null = null;

  // BehaviorSubjects for reactive updates
  private pendingRequestsSubject = new BehaviorSubject<Friendship[]>([]);
  private friendsSubject = new BehaviorSubject<string[]>([]);

  // Track all friendships for the current user by other user's ID
  private friendshipsByUserIdSubject = new BehaviorSubject<
    Map<
      string,
      {
        status: FriendshipStatus;
        id: string;
        initiatedByMe: boolean;
      }
    >
  >(new Map());

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

    // Setup real-time subscriptions when authenticated
    this.authService.user$.subscribe((user) => {
      if (user) {
        this.setupRealtimeSubscriptions(user.id);
        // Initial load of data
        this.loadAllFriendships(user.id);
      } else {
        this.cleanupSubscriptions();
      }
    });
  }

  // Load all friendships for the current user
  private loadAllFriendships(userId: string): void {
    // Get all friendships where the current user is involved
    from(
      this.supabase
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    ).subscribe({
      next: ({ data, error }) => {
        if (error) {
          console.error('Error loading friendships:', error);
          return;
        }

        if (!data) return;

        // Process the friendships
        this.processFriendships(data, userId);
      },
    });
  }

  // Process and organize friendships data
  private processFriendships(friendships: any[], currentUserId: string): void {
    // Clear existing data
    const friendshipMap = new Map<
      string,
      {
        status: FriendshipStatus;
        id: string;
        initiatedByMe: boolean;
      }
    >();

    const pendingRequests: Friendship[] = [];
    const acceptedFriendIds: string[] = [];

    // Process each friendship
    friendships.forEach((friendship) => {
      const otherUserId =
        friendship.user_id === currentUserId
          ? friendship.friend_id
          : friendship.user_id;

      const initiatedByMe = friendship.user_id === currentUserId;

      // Store in the map
      friendshipMap.set(otherUserId, {
        status: friendship.status,
        id: friendship.id,
        initiatedByMe,
      });

      // Sort into appropriate categories
      if (friendship.status === FriendshipStatus.PENDING) {
        // If current user is the recipient, it's a pending request
        if (!initiatedByMe) {
          pendingRequests.push(friendship);
        }
      } else if (friendship.status === FriendshipStatus.ACCEPTED) {
        acceptedFriendIds.push(otherUserId);
      }
    });

    // Update all relevant subjects
    this.friendshipsByUserIdSubject.next(friendshipMap);
    this.friendsSubject.next(acceptedFriendIds);

    // Load user details for pending requests
    if (pendingRequests.length > 0) {
      this.loadUserDetailsForRequests(pendingRequests);
    } else {
      this.pendingRequestsSubject.next([]);
    }
  }

  // Load user details for pending requests
  private loadUserDetailsForRequests(pendingRequests: any[]): void {
    const userIds = pendingRequests.map((req) => req.user_id);

    from(
      this.supabase
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds)
    ).subscribe({
      next: ({ data, error }) => {
        if (error) {
          console.error('Error loading user details:', error);
          return;
        }

        if (!data) return;

        // Create a map of user details
        const userMap = new Map();
        data.forEach((user) => {
          userMap.set(user.id, user);
        });

        // Enrich pending requests with user details
        const enrichedRequests = pendingRequests.map((req) => ({
          ...req,
          users: userMap.get(req.user_id),
        }));

        this.pendingRequestsSubject.next(enrichedRequests);
      },
    });
  }

  // New methods for real-time subscriptions
  private setupRealtimeSubscriptions(userId: string): void {
    this.cleanupSubscriptions();

    // Subscribe to all friendships involving the current user
    this.friendRequestsSubscription = this.supabase
      .channel('friendship-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${userId}`, // Filter for requests to this user
        },
        (payload) => {
          console.log('Friendship change (as recipient):', payload);
          // Reload all friendships when there's a change
          this.loadAllFriendships(userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user_id=eq.${userId}`, // Filter for requests from this user
        },
        (payload) => {
          console.log('Friendship change (as sender):', payload);
          // Reload all friendships when there's a change
          this.loadAllFriendships(userId);
        }
      )
      .subscribe();
  }

  private cleanupSubscriptions(): void {
    if (this.friendRequestsSubscription) {
      this.supabase.removeChannel(this.friendRequestsSubscription);
      this.friendRequestsSubscription = null;
    }

    if (this.friendshipUpdatesSubscription) {
      this.supabase.removeChannel(this.friendshipUpdatesSubscription);
      this.friendshipUpdatesSubscription = null;
    }
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
              .pipe(
                map(() => {
                  // Immediately update local state
                  this.updateLocalFriendshipState(
                    friendId,
                    data[0].id,
                    FriendshipStatus.PENDING,
                    true
                  );
                  return data[0] as Friendship;
                })
              );
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

            // Immediately update local state
            this.updateLocalFriendshipState(
              data.user_id,
              friendshipId,
              FriendshipStatus.ACCEPTED,
              false
            );

            // Create a notification for the original sender
            return this.notificationService
              .createNotification({
                userId: data.user_id,
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

            // Immediately update local state
            this.updateLocalFriendshipState(
              data.user_id,
              friendshipId,
              FriendshipStatus.REJECTED,
              false
            );

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
  // src/app/core/services/friendship.service.ts
  // Fix the removeFriendship method

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

    // First find the friendship record to get its ID
    return from(
      this.supabase
        .from('friendships')
        .select('id')
        .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
        .or(`user_id.eq.${friendId},friend_id.eq.${friendId}`)
        .limit(1)
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Friendship not found');
        }

        const friendshipId = data[0].id;

        // Now delete the friendship by ID (which is more reliable)
        return from(
          this.supabase.from('friendships').delete().eq('id', friendshipId)
        );
      }),
      map(({ error }) => {
        if (error) throw error;

        // Immediately update local state
        this.updateLocalFriendshipState(friendId, '', null, false);
      }),
      catchError((error) => {
        console.error('Error removing friendship:', error);
        return throwError(() => error);
      })
    );
  }
  // Update local state for immediate UI feedback
  private updateLocalFriendshipState(
    otherUserId: string,
    friendshipId: string,
    status: FriendshipStatus | null,
    initiatedByMe: boolean
  ): void {
    // Update friendship map
    const currentMap = this.friendshipsByUserIdSubject.getValue();
    const newMap = new Map(currentMap);

    if (status === null) {
      // Remove friendship
      newMap.delete(otherUserId);
    } else {
      // Add or update friendship
      newMap.set(otherUserId, { status, id: friendshipId, initiatedByMe });
    }

    this.friendshipsByUserIdSubject.next(newMap);

    // Update friends list if needed
    if (status === FriendshipStatus.ACCEPTED) {
      const currentFriends = this.friendsSubject.getValue();
      if (!currentFriends.includes(otherUserId)) {
        this.friendsSubject.next([...currentFriends, otherUserId]);
      }
    } else {
      // Changed this part - status could be null, so separate the condition
      const currentFriends = this.friendsSubject.getValue();
      this.friendsSubject.next(
        currentFriends.filter((id) => id !== otherUserId)
      );
    }

    // Update pending requests if needed
    if (status === FriendshipStatus.PENDING && !initiatedByMe) {
      // This is a new pending request to current user, but we'll let the real-time
      // subscription handle the details loading to avoid redundancy
    } else {
      // Remove from pending requests if it was there
      const currentRequests = this.pendingRequestsSubject.getValue();
      this.pendingRequestsSubject.next(
        currentRequests.filter((req) => req.user_id !== otherUserId)
      );
    }
  }

  /**
   * Get all friends of the current user
   * @returns Observable with array of user ids who are friends
   */
  getFriends(): Observable<string[]> {
    return this.friendsSubject.asObservable();
  }

  // Expose BehaviorSubjects as Observables
  get pendingFriendRequests$(): Observable<Friendship[]> {
    return this.pendingRequestsSubject.asObservable();
  }

  get friends$(): Observable<string[]> {
    return this.friendsSubject.asObservable();
  }

  get friendshipsByUserId$(): Observable<
    Map<
      string,
      {
        status: FriendshipStatus;
        id: string;
        initiatedByMe: boolean;
      }
    >
  > {
    return this.friendshipsByUserIdSubject.asObservable();
  }

  /**
   * Get pending friend requests sent to the current user
   * @returns Observable with array of friendships with user data
   */
  getPendingFriendRequests(): Observable<Friendship[]> {
    return this.pendingFriendRequests$;
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
    return this.friendshipsByUserId$.pipe(
      map((friendshipMap) => {
        if (friendshipMap.has(friendId)) {
          return friendshipMap.get(friendId)!;
        }
        return null;
      })
    );
  }
}
