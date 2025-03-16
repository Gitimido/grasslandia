// src/app/core/services/like.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from '@supabase/supabase-js';
import { Observable, from, of, throwError, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class LikeService implements OnDestroy {
  private supabase: SupabaseClient;
  private likesSubscription: RealtimeChannel | null = null;
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

  // Add these to track recently added/removed likes
  private recentlyAddedLikes = new Set<string>(); // Format: "user_id:post:post_id" or "user_id:comment:comment_id"
  private recentlyRemovedLikes = new Set<string>(); // Same format

  constructor(private authService: AuthService) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

    // Setup realtime subscription
    this.setupRealtimeSubscription();

    // Subscribe to auth changes to setup/teardown realtime subscription
    this.authService.user$.subscribe((user) => {
      if (user) {
        this.setupRealtimeSubscription();
      } else {
        this.cleanupSubscription();
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupSubscription();
  }

  private setupRealtimeSubscription(): void {
    this.cleanupSubscription();

    // Subscribe to likes table for real-time updates
    this.likesSubscription = this.supabase
      .channel('likes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'likes' },
        (payload) => {
          console.log('Like change detected:', payload);

          // Handle different events
          if (payload.eventType === 'INSERT') {
            const userId = payload.new['user_id'];
            const postId = payload.new['post_id'];
            const commentId = payload.new['comment_id'];

            // Create tracking key based on content type
            const trackingKey = postId
              ? `${userId}:post:${postId}`
              : `${userId}:comment:${commentId}`;

            // Skip if this is a like we just added optimistically
            if (this.recentlyAddedLikes.has(trackingKey)) {
              console.log(
                'Skipping realtime like insert, already handled locally:',
                trackingKey
              );
              this.recentlyAddedLikes.delete(trackingKey);
              return;
            }

            this.handleLikeInsert(payload.new);
          } else if (payload.eventType === 'DELETE') {
            const userId = payload.old['user_id'];
            const postId = payload.old['post_id'];
            const commentId = payload.old['comment_id'];

            // Create tracking key based on content type
            const trackingKey = postId
              ? `${userId}:post:${postId}`
              : `${userId}:comment:${commentId}`;

            // Skip if this is an unlike we just processed optimistically
            if (this.recentlyRemovedLikes.has(trackingKey)) {
              console.log(
                'Skipping realtime like delete, already handled locally:',
                trackingKey
              );
              this.recentlyRemovedLikes.delete(trackingKey);
              return;
            }

            this.handleLikeDelete(payload.old);
          }
        }
      )
      .subscribe();
  }

  private cleanupSubscription(): void {
    if (this.likesSubscription) {
      this.supabase.removeChannel(this.likesSubscription);
      this.likesSubscription = null;
    }

    // Clean up tracking sets
    this.recentlyAddedLikes.clear();
    this.recentlyRemovedLikes.clear();
  }

  // Handle new like insertion
  private handleLikeInsert(like: any): void {
    if (like.post_id) {
      // Update post likes count
      const currentLikes = this.postLikes.value;
      const postId = like.post_id;
      const newCount = (currentLikes[postId] || 0) + 1;
      this.postLikes.next({
        ...currentLikes,
        [postId]: newCount,
      });

      // Update user post likes if this is the current user
      if (like.user_id === this.authService.user?.id) {
        const userLikes = this.userPostLikes.value;
        this.userPostLikes.next({
          ...userLikes,
          [postId]: true,
        });
      }
    } else if (like.comment_id) {
      // Update comment likes count
      const currentLikes = this.commentLikes.value;
      const commentId = like.comment_id;
      const newCount = (currentLikes[commentId] || 0) + 1;
      this.commentLikes.next({
        ...currentLikes,
        [commentId]: newCount,
      });

      // Update user comment likes if this is the current user
      if (like.user_id === this.authService.user?.id) {
        const userLikes = this.userCommentLikes.value;
        this.userCommentLikes.next({
          ...userLikes,
          [commentId]: true,
        });
      }
    }
  }

  // Handle like deletion
  private handleLikeDelete(like: any): void {
    if (like.post_id) {
      // Update post likes count
      const currentLikes = this.postLikes.value;
      const postId = like.post_id;
      const newCount = Math.max(0, (currentLikes[postId] || 0) - 1);
      this.postLikes.next({
        ...currentLikes,
        [postId]: newCount,
      });

      // Update user post likes if this is the current user
      if (like.user_id === this.authService.user?.id) {
        const userLikes = this.userPostLikes.value;
        this.userPostLikes.next({
          ...userLikes,
          [postId]: false,
        });
      }
    } else if (like.comment_id) {
      // Update comment likes count
      const currentLikes = this.commentLikes.value;
      const commentId = like.comment_id;
      const newCount = Math.max(0, (currentLikes[commentId] || 0) - 1);
      this.commentLikes.next({
        ...currentLikes,
        [commentId]: newCount,
      });

      // Update user comment likes if this is the current user
      if (like.user_id === this.authService.user?.id) {
        const userLikes = this.userCommentLikes.value;
        this.userCommentLikes.next({
          ...userLikes,
          [commentId]: false,
        });
      }
    }
  }

  // Get post likes as an observable
  getPostLikesObservable(postId: string): Observable<number> {
    // First load the initial count
    this.getPostLikeCount(postId).subscribe((count) => {
      const currentLikes = this.postLikes.value;
      if (!currentLikes[postId]) {
        this.postLikes.next({
          ...currentLikes,
          [postId]: count,
        });
      }
    });

    // Return the observable that will update in real-time
    return this.postLikes
      .asObservable()
      .pipe(map((likes) => likes[postId] || 0));
  }

  // Get comment likes as an observable
  getCommentLikesObservable(commentId: string): Observable<number> {
    // First load the initial count
    this.getCommentLikeCount(commentId).subscribe((count) => {
      const currentLikes = this.commentLikes.value;
      if (!currentLikes[commentId]) {
        this.commentLikes.next({
          ...currentLikes,
          [commentId]: count,
        });
      }
    });

    // Return the observable that will update in real-time
    return this.commentLikes
      .asObservable()
      .pipe(map((likes) => likes[commentId] || 0));
  }

  // Get user post like status as an observable
  getUserPostLikeObservable(postId: string): Observable<boolean> {
    // First check the initial state
    this.hasUserLikedPost(postId).subscribe((liked) => {
      const userLikes = this.userPostLikes.value;
      if (userLikes[postId] === undefined) {
        this.userPostLikes.next({
          ...userLikes,
          [postId]: liked,
        });
      }
    });

    // Return the observable that will update in real-time
    return this.userPostLikes
      .asObservable()
      .pipe(map((likes) => likes[postId] || false));
  }

  // Get user comment like status as an observable
  getUserCommentLikeObservable(commentId: string): Observable<boolean> {
    // First check the initial state
    this.hasUserLikedComment(commentId).subscribe((liked) => {
      const userLikes = this.userCommentLikes.value;
      if (userLikes[commentId] === undefined) {
        this.userCommentLikes.next({
          ...userLikes,
          [commentId]: liked,
        });
      }
    });

    // Return the observable that will update in real-time
    return this.userCommentLikes
      .asObservable()
      .pipe(map((likes) => likes[commentId] || false));
  }

  // Original methods with local state updates
  likePost(postId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Track this action to prevent double counting in realtime updates
    const trackingKey = `${userId}:post:${postId}`;
    this.recentlyAddedLikes.add(trackingKey);

    return from(
      this.supabase.from('likes').insert({
        user_id: userId,
        post_id: postId,
        comment_id: null,
      })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;

        // Update local state immediately for better UX
        const userLikes = this.userPostLikes.value;
        this.userPostLikes.next({
          ...userLikes,
          [postId]: true,
        });

        const currentLikes = this.postLikes.value;
        this.postLikes.next({
          ...currentLikes,
          [postId]: (currentLikes[postId] || 0) + 1,
        });

        // Add explicit return
        return undefined;
      }),
      catchError((error) => {
        // On error, remove from tracking so future like attempts will work
        this.recentlyAddedLikes.delete(trackingKey);
        console.error('Error liking post:', error);
        return throwError(() => error);
      })
    );
  }

  unlikePost(postId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Track this action to prevent double counting in realtime updates
    const trackingKey = `${userId}:post:${postId}`;
    this.recentlyRemovedLikes.add(trackingKey);

    console.log(`Unliking post: ${postId}, userId: ${userId}`);

    return from(
      this.supabase
        .from('likes')
        .delete()
        .match({ user_id: userId, post_id: postId })
    ).pipe(
      map(({ error, data }) => {
        if (error) {
          console.error('Supabase error unliking post:', error);
          throw error;
        }

        console.log(`Unlike result:`, data);

        // Update local state immediately for better UX
        const userLikes = this.userPostLikes.value;
        this.userPostLikes.next({
          ...userLikes,
          [postId]: false,
        });

        const currentLikes = this.postLikes.value;
        this.postLikes.next({
          ...currentLikes,
          [postId]: Math.max(0, (currentLikes[postId] || 0) - 1),
        });

        // Add explicit return
        return undefined;
      }),
      catchError((error) => {
        // On error, remove from tracking so future unlike attempts will work
        this.recentlyRemovedLikes.delete(trackingKey);
        console.error('Error unliking post:', error);
        return throwError(() => error);
      })
    );
  }

  hasUserLikedPost(postId: string): Observable<boolean> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return of(false);
    }

    return from(
      this.supabase
        .from('likes')
        .select('id')
        .match({ user_id: userId, post_id: postId })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data && data.length > 0;
      }),
      catchError((error) => {
        console.error('Error checking if post is liked:', error);
        return of(false);
      })
    );
  }

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

  likeComment(commentId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Track this action to prevent double counting in realtime updates
    const trackingKey = `${userId}:comment:${commentId}`;
    this.recentlyAddedLikes.add(trackingKey);

    return from(
      this.supabase.from('likes').insert({
        user_id: userId,
        post_id: null,
        comment_id: commentId,
      })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;

        // Update local state immediately for better UX
        const userLikes = this.userCommentLikes.value;
        this.userCommentLikes.next({
          ...userLikes,
          [commentId]: true,
        });

        const currentLikes = this.commentLikes.value;
        this.commentLikes.next({
          ...currentLikes,
          [commentId]: (currentLikes[commentId] || 0) + 1,
        });

        // Add explicit return
        return undefined;
      }),
      catchError((error) => {
        // On error, remove from tracking
        this.recentlyAddedLikes.delete(trackingKey);
        console.error('Error liking comment:', error);
        return throwError(() => error);
      })
    );
  }

  unlikeComment(commentId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Track this action to prevent double counting in realtime updates
    const trackingKey = `${userId}:comment:${commentId}`;
    this.recentlyRemovedLikes.add(trackingKey);

    return from(
      this.supabase
        .from('likes')
        .delete()
        .match({ user_id: userId, comment_id: commentId })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;

        // Update local state immediately for better UX
        const userLikes = this.userCommentLikes.value;
        this.userCommentLikes.next({
          ...userLikes,
          [commentId]: false,
        });

        const currentLikes = this.commentLikes.value;
        this.commentLikes.next({
          ...currentLikes,
          [commentId]: Math.max(0, (currentLikes[commentId] || 0) - 1),
        });

        // Add explicit return
        return undefined;
      }),
      catchError((error) => {
        // On error, remove from tracking
        this.recentlyRemovedLikes.delete(trackingKey);
        console.error('Error unliking comment:', error);
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
        .match({ user_id: userId, comment_id: commentId })
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
