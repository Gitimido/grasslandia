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
  timer,
  Subject,
} from 'rxjs';
import {
  map,
  catchError,
  tap,
  retry,
  debounceTime,
  switchMap,
  finalize,
  take,
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

  constructor(private authService: AuthService) {
    console.log('LikeService initialized');
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

    // Initial realtime subscriptions
    this.setupRealtimeSubscriptions();

    // Subscribe to auth changes to restart subscriptions if user changes
    this.authService.user$.subscribe((user) => {
      // Always clean up and reset subscriptions when user changes
      this.cleanupSubscriptions();

      if (user) {
        // Delay setup slightly to ensure clean state
        setTimeout(() => {
          this.setupRealtimeSubscriptions();
        }, 500);
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

    // Clear any pending operations
    this.pendingPostOperations.clear();
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
      // Comment like logic unchanged
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
      // Comment like logic unchanged
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
        retry(3000), // Retry up to 3 times if network issues
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

  // Fetch current comment like count from database
  private refreshCommentLikeCount(commentId: string): void {
    from(
      this.supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('comment_id', commentId)
    )
      .pipe(
        retry(3000),
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

  // Get post likes as an observable
  getPostLikesObservable(postId: string): Observable<number> {
    // First, fetch the initial count from the server
    this.refreshPostLikeCount(postId);

    // Return the observable that will update in real-time
    return this.postLikes.asObservable().pipe(
      map((likes) => likes[postId] || 0),
      // Add debounce to avoid rapid UI updates
      debounceTime(50)
    );
  }

  // Get comment likes as an observable
  getCommentLikesObservable(commentId: string): Observable<number> {
    // Comment likes implementation unchanged
    this.refreshCommentLikeCount(commentId);

    return this.commentLikes.asObservable().pipe(
      map((likes) => likes[commentId] || 0),
      debounceTime(50)
    );
  }

  // Get user post like status as an observable
  getUserPostLikeObservable(postId: string): Observable<boolean> {
    // Check if the user has liked this post
    this.hasUserLikedPost(postId).subscribe((liked) => {
      const userLikes = this.userPostLikes.value;
      this.userPostLikes.next({
        ...userLikes,
        [postId]: liked,
      });
    });

    // Return the observable
    return this.userPostLikes
      .asObservable()
      .pipe(map((likes) => likes[postId] || false));
  }

  // Get user comment like status as an observable
  getUserCommentLikeObservable(commentId: string): Observable<boolean> {
    // Comment like status implementation unchanged
    this.hasUserLikedComment(commentId).subscribe((liked) => {
      const userLikes = this.userCommentLikes.value;
      this.userCommentLikes.next({
        ...userLikes,
        [commentId]: liked,
      });
    });

    return this.userCommentLikes
      .asObservable()
      .pipe(map((likes) => likes[commentId] || false));
  }

  // Like a post - COMPLETELY REWRITTEN
  likePost(postId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Generate a unique operation key
    const operationKey = `like:${postId}`;

    // If there's already a pending operation for this post, return an error
    if (this.pendingPostOperations.has(operationKey)) {
      console.log(
        `Operation ${operationKey} already in progress, ignoring duplicate request`
      );
      return throwError(() => new Error('Operation already in progress'));
    }

    // First check if the user has already liked this post
    return this.hasUserLikedPost(postId).pipe(
      switchMap((isLiked) => {
        // If already liked, return early
        if (isLiked) {
          console.log(`Post ${postId} is already liked, ignoring request`);
          return of(undefined);
        }

        console.log(`Liking post: ${postId}, userId: ${userId}`);

        // Mark operation as pending
        this.pendingPostOperations.add(operationKey);

        // Update local state optimistically
        const userLikes = this.userPostLikes.value;
        this.userPostLikes.next({
          ...userLikes,
          [postId]: true,
        });

        // Get current count to increment optimistically
        const currentCount = this.postLikes.value[postId] || 0;
        this.postLikes.next({
          ...this.postLikes.value,
          [postId]: currentCount + 1,
        });

        // Now perform the actual insert
        return from(
          this.supabase.from('likes').insert({
            user_id: userId,
            post_id: postId,
            comment_id: null,
          })
        ).pipe(
          tap((response) => {
            console.log('Like post response:', response);
          }),
          map(({ error }) => {
            if (error) throw error;
            // Force refresh the count after a slight delay
            setTimeout(() => this.refreshPostLikeCount(postId), 300);
            return undefined;
          }),
          catchError((error) => {
            console.error('Error liking post:', error);

            // Revert optimistic updates on error
            this.userPostLikes.next({
              ...this.userPostLikes.value,
              [postId]: false,
            });

            this.postLikes.next({
              ...this.postLikes.value,
              [postId]: Math.max(0, currentCount),
            });

            return throwError(() => error);
          }),
          finalize(() => {
            // Operation finished, remove from pending set
            this.pendingPostOperations.delete(operationKey);
          })
        );
      }),
      // Catch errors from hasUserLikedPost
      catchError((error) => {
        console.error('Error checking like status:', error);
        return throwError(() => error);
      })
    );
  }

  // Unlike a post - COMPLETELY REWRITTEN
  unlikePost(postId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Generate a unique operation key
    const operationKey = `unlike:${postId}`;

    // If there's already a pending operation for this post, return an error
    if (this.pendingPostOperations.has(operationKey)) {
      console.log(
        `Operation ${operationKey} already in progress, ignoring duplicate request`
      );
      return throwError(() => new Error('Operation already in progress'));
    }

    // First check if the user has actually liked this post
    return this.hasUserLikedPost(postId).pipe(
      switchMap((isLiked) => {
        // If not liked, return early
        if (!isLiked) {
          console.log(`Post ${postId} is not liked, ignoring unlike request`);
          return of(undefined);
        }

        console.log(`Unliking post: ${postId}, userId: ${userId}`);

        // Mark operation as pending
        this.pendingPostOperations.add(operationKey);

        // Update local state optimistically
        const userLikes = this.userPostLikes.value;
        this.userPostLikes.next({
          ...userLikes,
          [postId]: false,
        });

        // Get current count to decrement optimistically
        const currentCount = this.postLikes.value[postId] || 0;
        this.postLikes.next({
          ...this.postLikes.value,
          [postId]: Math.max(0, currentCount - 1),
        });

        // Now perform the actual delete
        return from(
          this.supabase.from('likes').delete().match({
            user_id: userId,
            post_id: postId,
          })
        ).pipe(
          tap((response) => {
            console.log('Unlike post response:', response);
          }),
          map(({ error, data }) => {
            if (error) {
              console.error('Supabase error unliking post:', error);
              throw error;
            }

            console.log(`Unlike result:`, data);

            // Force refresh the count after a slight delay
            setTimeout(() => this.refreshPostLikeCount(postId), 300);
            return undefined;
          }),
          catchError((error) => {
            console.error('Error unliking post:', error);

            // Revert optimistic updates on error
            this.userPostLikes.next({
              ...this.userPostLikes.value,
              [postId]: true,
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
      }),
      // Catch errors from hasUserLikedPost
      catchError((error) => {
        console.error('Error checking like status:', error);
        return throwError(() => error);
      })
    );
  }

  // Check if user has liked a post
  hasUserLikedPost(postId: string): Observable<boolean> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return of(false);
    }

    return from(
      this.supabase
        .from('likes')
        .select('id')
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

  // Get like count for a post
  getPostLikeCount(postId: string): Observable<number> {
    return from(
      this.supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId)
    ).pipe(
      map(({ count, error }) => {
        if (error) throw error;
        return count || 0;
      }),
      catchError((error) => {
        console.error('Error getting post like count:', error);
        return of(0);
      })
    );
  }

  // Comment like/unlike methods remain unchanged
  likeComment(commentId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Update local state optimistically
    const userLikes = this.userCommentLikes.value;
    this.userCommentLikes.next({
      ...userLikes,
      [commentId]: true,
    });

    return from(
      this.supabase.from('likes').insert({
        user_id: userId,
        post_id: null,
        comment_id: commentId,
      })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
        // The actual count will be updated via the realtime subscription
        return undefined;
      }),
      catchError((error) => {
        console.error('Error liking comment:', error);

        // Revert optimistic update on error
        const userLikes = this.userCommentLikes.value;
        this.userCommentLikes.next({
          ...userLikes,
          [commentId]: false,
        });

        return throwError(() => error);
      })
    );
  }

  unlikeComment(commentId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Update local state optimistically
    const userLikes = this.userCommentLikes.value;
    this.userCommentLikes.next({
      ...userLikes,
      [commentId]: false,
    });

    return from(
      this.supabase
        .from('likes')
        .delete()
        .eq('user_id', userId)
        .eq('comment_id', commentId)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;

        // Force a refresh after a slight delay
        setTimeout(() => {
          this.refreshCommentLikeCount(commentId);
        }, 300);

        return undefined;
      }),
      tap(() => {
        // Manually force another check after a delay
        timer(1000).subscribe(() => this.refreshCommentLikeCount(commentId));
      }),
      catchError((error) => {
        console.error('Error unliking comment:', error);

        // Revert optimistic update on error
        const userLikes = this.userCommentLikes.value;
        this.userCommentLikes.next({
          ...userLikes,
          [commentId]: true,
        });

        return throwError(() => error);
      })
    );
  }

  hasUserLikedComment(commentId: string): Observable<boolean> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return of(false);
    }

    return from(
      this.supabase
        .from('likes')
        .select('id')
        .eq('user_id', userId)
        .eq('comment_id', commentId)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data && data.length > 0;
      }),
      catchError((error) => {
        console.error('Error checking if comment is liked:', error);
        return of(false);
      })
    );
  }

  getCommentLikeCount(commentId: string): Observable<number> {
    return from(
      this.supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('comment_id', commentId)
    ).pipe(
      map(({ count, error }) => {
        if (error) throw error;
        return count || 0;
      }),
      catchError((error) => {
        console.error('Error getting comment like count:', error);
        return of(0);
      })
    );
  }
}
