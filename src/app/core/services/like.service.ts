// src/app/core/services/like.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, of, throwError, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class LikeService {
  private supabase: SupabaseClient;

  constructor(private authService: AuthService) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  /**
   * Like a post
   * @param postId The ID of the post to like
   * @returns Observable indicating success
   */
  likePost(postId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return from(
      this.supabase.from('likes').insert({
        user_id: userId,
        post_id: postId,
        comment_id: null,
      })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => {
        console.error('Error liking post:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Unlike a post
   * @param postId The ID of the post to unlike
   * @returns Observable indicating success
   */
  unlikePost(postId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return from(
      this.supabase
        .from('likes')
        .delete()
        .match({ user_id: userId, post_id: postId })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => {
        console.error('Error unliking post:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if a user has liked a post
   * @param postId The ID of the post
   * @returns Observable with boolean indicating if post is liked
   */
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

  /**
   * Get the count of likes for a post
   * @param postId The ID of the post
   * @returns Observable with the like count
   */
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

  /**
   * Like a comment
   * @param commentId The ID of the comment to like
   * @returns Observable indicating success
   */
  likeComment(commentId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return from(
      this.supabase.from('likes').insert({
        user_id: userId,
        post_id: null,
        comment_id: commentId,
      })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => {
        console.error('Error liking comment:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Unlike a comment
   * @param commentId The ID of the comment to unlike
   * @returns Observable indicating success
   */
  unlikeComment(commentId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return from(
      this.supabase
        .from('likes')
        .delete()
        .match({ user_id: userId, comment_id: commentId })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => {
        console.error('Error unliking comment:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if a user has liked a comment
   * @param commentId The ID of the comment
   * @returns Observable with boolean indicating if comment is liked
   */
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

  /**
   * Get the count of likes for a comment
   * @param commentId The ID of the comment
   * @returns Observable with the like count
   */
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
