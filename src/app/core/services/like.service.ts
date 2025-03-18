// src/app/core/services/like.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from '@supabase/supabase-js';
import {
  Observable,
  from,
  of,
  throwError,
  BehaviorSubject,
  skip,
  timer,
} from 'rxjs';
import {
  map,
  catchError,
  take,
  debounceTime,
  switchMap,
  finalize,
  tap,
} from 'rxjs/operators';
import { environment } from '../../../environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class LikeService implements OnDestroy {
  private supabase: SupabaseClient;
  private likesSubscription: RealtimeChannel | null = null;
  private postLikesChannel: RealtimeChannel | null = null;

  // Store like state in BehaviorSubjects
  private postLikes = new BehaviorSubject<{ [postId: string]: number }>({});
  private commentLikes = new BehaviorSubject<{ [commentId: string]: number }>(
    {}
  );
  private userPostLikes = new BehaviorSubject<{ [postId: string]: boolean }>(
    {}
  );
  private userCommentLikes = new BehaviorSubject<{
    [commentId: string]: boolean;
  }>({});

  // Set to track ongoing like/unlike operations to prevent duplicates
  private pendingPostOperations = new Set<string>();

  // Track initialization state
  private initialized = false;

  constructor(private authService: AuthService) {
    console.log('LikeService initialized');
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

    // Subscribe to auth changes to restart subscriptions if user changes
    this.authService.user$.pipe(take(1)).subscribe((user) => {
      if (user && !this.initialized) {
        this.initialized = true;
        this.setupRealtimeSubscriptions();
      }
    });

    // Handle auth changes more efficiently
    this.authService.user$.pipe(skip(1)).subscribe((user) => {
      // Always clean up subscriptions when user changes
      this.cleanupSubscriptions();

      if (user) {
        // Setup new subscriptions for the new user
        this.setupRealtimeSubscriptions();
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupSubscriptions();
  }

  private setupRealtimeSubscriptions(): void {
    console.log('Setting up realtime subscriptions for likes');

    // Create main likes table subscription
    this.likesSubscription = this.supabase
      .channel('likes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'likes' },
        (payload) => {
          console.log(
            'Like change event received:',
            payload.eventType,
            payload
          );

          // Process the payload based on event type
          if (payload.eventType === 'INSERT') {
            this.handleLikeInsert(payload.new);
          } else if (payload.eventType === 'DELETE') {
            this.handleLikeDelete(payload.old);
          }
        }
      )
      .subscribe((status) => {
        console.log('Likes channel status:', status);
      });

    // Create a separate channel for like count updates
    this.postLikesChannel = this.supabase
      .channel('post-like-counts')
      .on('broadcast', { event: 'like-count-update' }, (payload) => {
        console.log('Received like count broadcast:', payload);

        if (payload['payload'] && typeof payload['payload'] === 'object') {
          const { postId, count } = payload['payload'];
          if (postId && typeof count === 'number') {
            // Update local state with the received count
            const currentLikes = this.postLikes.value;
            this.postLikes.next({
              ...currentLikes,
              [postId]: count,
            });
          }
        }
      })
      .subscribe();
  }

  private cleanupSubscriptions(): void {
    console.log('Cleaning up like service subscriptions');

    if (this.likesSubscription) {
      this.supabase.removeChannel(this.likesSubscription);
      this.likesSubscription = null;
    }

    if (this.postLikesChannel) {
      this.supabase.removeChannel(this.postLikesChannel);
      this.postLikesChannel = null;
    }

    // Clear any pending operations and state
    this.pendingPostOperations.clear();
    this.initialized = false;
  }

  // Handle like insert events from realtime subscription
  private handleLikeInsert(like: any): void {
    console.log('Processing like insert event:', like);

    if (like.post_id) {
      // Refresh the actual count from the server instead of incrementing
      this.refreshPostLikeCount(like.post_id);

      // Update user like status if this is the current user
      if (like.user_id === this.authService.user?.id) {
        const userLikes = this.userPostLikes.value;
        this.userPostLikes.next({
          ...userLikes,
          [like.post_id]: true,
        });
      }
    } else if (like.comment_id) {
      // Comment like logic
      this.refreshCommentLikeCount(like.comment_id);

      if (like.user_id === this.authService.user?.id) {
        const userLikes = this.userCommentLikes.value;
        this.userCommentLikes.next({
          ...userLikes,
          [like.comment_id]: true,
        });
      }
    }
  }

  // Handle like delete events from realtime subscription
  private handleLikeDelete(like: any): void {
    console.log('Processing like delete event:', like);

    if (like.post_id) {
      // Refresh the actual count from the server instead of decrementing
      this.refreshPostLikeCount(like.post_id);

      // Update user like status if this is the current user
      if (like.user_id === this.authService.user?.id) {
        const userLikes = this.userPostLikes.value;
        this.userPostLikes.next({
          ...userLikes,
          [like.post_id]: false,
        });
      }
    } else if (like.comment_id) {
      // Comment like logic
      this.refreshCommentLikeCount(like.comment_id);

      if (like.user_id === this.authService.user?.id) {
        const userLikes = this.userCommentLikes.value;
        this.userCommentLikes.next({
          ...userLikes,
          [like.comment_id]: false,
        });
      }
    }
  }

  // Fetch current like count from database and update local state
  private refreshPostLikeCount(postId: string): void {
    console.log(`Refreshing like count for post ${postId}`);

    from(
      this.supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId)
    )
      .pipe(
        take(1), // Take only one result and complete
        map(({ count, error }) => {
          if (error) throw error;
          return count || 0;
        }),
        catchError((error) => {
          console.error(`Error fetching like count for post ${postId}:`, error);
          return of(null); // Return null on error
        })
      )
      .subscribe((count) => {
        if (count !== null) {
          console.log(
            `Received updated like count for post ${postId}: ${count}`
          );

          // Update local state
          const currentLikes = this.postLikes.value;
          this.postLikes.next({
            ...currentLikes,
            [postId]: count,
          });

          // Broadcast the updated count to all clients
          this.broadcastLikeCountUpdate(postId, count);
        }
      });
  }

  // Broadcast the like count to all clients
  private broadcastLikeCountUpdate(postId: string, count: number): void {
    if (this.postLikesChannel) {
      this.postLikesChannel.send({
        type: 'broadcast',
        event: 'like-count-update',
        payload: { postId, count },
      });
    }
  }

  // Fetch current comment like count from database - optimized with take(1)
  private refreshCommentLikeCount(commentId: string): void {
    from(
      this.supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('comment_id', commentId)
    )
      .pipe(
        take(1), // Take only one result and complete
        map(({ count, error }) => {
          if (error) throw error;
          return count || 0;
        }),
        catchError((error) => {
          console.error(
            `Error fetching like count for comment ${commentId}:`,
            error
          );
          return of(null);
        })
      )
      .subscribe((count) => {
        if (count !== null) {
          // Update local state
          const currentLikes = this.commentLikes.value;
          this.commentLikes.next({
            ...currentLikes,
            [commentId]: count,
          });
        }
      });
  }

  // FIXED: Get post likes as an observable - optimized version
  getPostLikesObservable(postId: string): Observable<number> {
    // Check if we already have this post like count
    if (!(postId in this.postLikes.value)) {
      // If not, fetch once from the server
      this.refreshPostLikeCount(postId);
    }

    // Return the observable that will update in real-time
    return this.postLikes.asObservable().pipe(
      map((likes) => likes[postId] || 0),
      // Add debounce to avoid rapid UI updates
      debounceTime(50)
    );
  }

  // FIXED: Get comment likes as an observable - optimized version
  getCommentLikesObservable(commentId: string): Observable<number> {
    // Check if we already have this comment like count
    if (!(commentId in this.commentLikes.value)) {
      // If not, fetch once from the server
      this.refreshCommentLikeCount(commentId);
    }

    return this.commentLikes.asObservable().pipe(
      map((likes) => likes[commentId] || 0),
      debounceTime(50)
    );
  }

  // FIXED: Get user post like status as an observable
  getUserPostLikeObservable(postId: string): Observable<boolean> {
    // Only fetch from the server if we don't have this post like status
    if (!(postId in this.userPostLikes.value)) {
      // Fetch once and update the behavior subject
      this.hasUserLikedPost(postId)
        .pipe(take(1))
        .subscribe((liked) => {
          const userLikes = this.userPostLikes.value;
          this.userPostLikes.next({
            ...userLikes,
            [postId]: liked,
          });
        });
    }

    // Return the observable
    return this.userPostLikes
      .asObservable()
      .pipe(map((likes) => likes[postId] || false));
  }

  // FIXED: Get user comment like status as an observable
  getUserCommentLikeObservable(commentId: string): Observable<boolean> {
    // Only fetch from the server if we don't have this comment like status
    if (!(commentId in this.userCommentLikes.value)) {
      // Fetch once and update the behavior subject
      this.hasUserLikedComment(commentId)
        .pipe(take(1))
        .subscribe((liked) => {
          const userLikes = this.userCommentLikes.value;
          this.userCommentLikes.next({
            ...userLikes,
            [commentId]: liked,
          });
        });
    }

    return this.userCommentLikes
      .asObservable()
      .pipe(map((likes) => likes[commentId] || false));
  }

  // Replace both likePost and unlikePost with this single method
  togglePostLike(postId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Generate a unique operation key
    const operationKey = `toggle:${postId}`;

    // If there's already a pending operation for this post, return an error
    if (this.pendingPostOperations.has(operationKey)) {
      console.log(
        `Operation ${operationKey} already in progress, ignoring duplicate request`
      );
      return throwError(() => new Error('Operation already in progress'));
    }

    // Mark operation as pending
    this.pendingPostOperations.add(operationKey);

    // Get current like status
    const isCurrentlyLiked = this.userPostLikes.value[postId] || false;

    // Update local state optimistically (toggle the current state)
    const userLikes = this.userPostLikes.value;
    this.userPostLikes.next({
      ...userLikes,
      [postId]: !isCurrentlyLiked,
    });

    // Get current count to adjust optimistically
    const currentCount = this.postLikes.value[postId] || 0;
    this.postLikes.next({
      ...this.postLikes.value,
      [postId]: isCurrentlyLiked
        ? Math.max(0, currentCount - 1)
        : currentCount + 1,
    });

    // Now perform the actual insert - this will toggle in the database due to our trigger
    return from(
      this.supabase.from('likes').insert({
        user_id: userId,
        post_id: postId,
        comment_id: null,
      })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
        // Force refresh the count once
        this.refreshPostLikeCount(postId);
        return undefined;
      }),
      catchError((error) => {
        console.error('Error toggling post like:', error);

        // Revert optimistic updates on error
        this.userPostLikes.next({
          ...this.userPostLikes.value,
          [postId]: isCurrentlyLiked,
        });

        this.postLikes.next({
          ...this.postLikes.value,
          [postId]: currentCount,
        });

        return throwError(() => error);
      }),
      finalize(() => {
        // Operation finished, remove from pending set
        this.pendingPostOperations.delete(operationKey);
      })
    );
  }

  // New toggleCommentLike method to replace likeComment and unlikeComment
  toggleCommentLike(commentId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Generate a unique operation key
    const operationKey = `toggle:comment:${commentId}`;

    // If there's already a pending operation for this comment, return an error
    if (this.pendingPostOperations.has(operationKey)) {
      console.log(
        `Operation ${operationKey} already in progress, ignoring duplicate request`
      );
      return throwError(() => new Error('Operation already in progress'));
    }

    // Mark operation as pending
    this.pendingPostOperations.add(operationKey);

    // Get current like status
    const isCurrentlyLiked = this.userCommentLikes.value[commentId] || false;

    // Update local state optimistically (toggle the current state)
    const userLikes = this.userCommentLikes.value;
    this.userCommentLikes.next({
      ...userLikes,
      [commentId]: !isCurrentlyLiked,
    });

    // Get current count to adjust optimistically
    const currentCount = this.commentLikes.value[commentId] || 0;
    this.commentLikes.next({
      ...this.commentLikes.value,
      [commentId]: isCurrentlyLiked
        ? Math.max(0, currentCount - 1)
        : currentCount + 1,
    });

    // Now perform the actual insert - this will toggle in the database due to our trigger
    return from(
      this.supabase.from('likes').insert({
        user_id: userId,
        post_id: null,
        comment_id: commentId,
      })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
        // Force refresh the count once
        this.refreshCommentLikeCount(commentId);
        return undefined;
      }),
      catchError((error) => {
        console.error('Error toggling comment like:', error);

        // Revert optimistic updates on error
        this.userCommentLikes.next({
          ...this.userCommentLikes.value,
          [commentId]: isCurrentlyLiked,
        });

        this.commentLikes.next({
          ...this.commentLikes.value,
          [commentId]: currentCount,
        });

        return throwError(() => error);
      }),
      finalize(() => {
        // Operation finished, remove from pending set
        this.pendingPostOperations.delete(operationKey);
      })
    );
  }

  // Check if user has liked a post - OPTIMIZED
  hasUserLikedPost(postId: string): Observable<boolean> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return of(false);
    }

    return from(
      this.supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('post_id', postId)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        const hasLiked = data && data.length > 0;
        console.log(`User ${userId} has liked post ${postId}: ${hasLiked}`);
        return hasLiked;
      }),
      catchError((error) => {
        console.error('Error checking if post is liked:', error);
        return of(false);
      })
    );
  }

  // Check if user has liked a comment - OPTIMIZED
  hasUserLikedComment(commentId: string): Observable<boolean> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return of(false);
    }

    return from(
      this.supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('comment_id', commentId)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        const hasLiked = data && data.length > 0;
        console.log(
          `User ${userId} has liked comment ${commentId}: ${hasLiked}`
        );
        return hasLiked;
      }),
      catchError((error) => {
        console.error('Error checking if comment is liked:', error);
        return of(false);
      })
    );
  }

  // Keep these methods for backward compatibility
  likePost(postId: string): Observable<void> {
    return this.togglePostLike(postId);
  }

  unlikePost(postId: string): Observable<void> {
    return this.togglePostLike(postId);
  }

  likeComment(commentId: string): Observable<void> {
    return this.toggleCommentLike(commentId);
  }

  unlikeComment(commentId: string): Observable<void> {
    return this.toggleCommentLike(commentId);
  }
}
