// src/app/core/services/comment.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, throwError, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environment';
import { AuthService } from './auth.service';
import { Comment, IComment, VoteType, ICommentUser } from '../../models';

@Injectable({
  providedIn: 'root',
})
export class CommentService {
  private supabase: SupabaseClient;

  constructor(private authService: AuthService) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  /**
   * Create a new comment on a post
   * @param postId The ID of the post
   * @param content The comment content
   * @param parentId Optional parent comment ID for replies
   * @returns Observable with the created comment
   */
  createComment(
    postId: string,
    content: string,
    parentId?: string
  ): Observable<Comment> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const commentData = {
      user_id: userId,
      post_id: postId,
      content: content,
      parent_id: parentId || null,
    };

    return from(
      this.supabase.from('comments').insert(commentData).select('*')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Failed to create comment');
        }

        // Create userData object with proper types
        const userData: ICommentUser = {
          id: userId,
          username: this.getUsernameFromAuth() || 'User',
          fullName: this.getFullNameFromAuth() || '',
          avatarUrl: this.getAvatarUrlFromAuth() || '',
          email: this.authService.user?.email || '',
        };

        // Map the data to a comment with the user data
        return this.mapComment({
          ...data[0],
          users: userData, // Using 'users' to match expected format in mapComment
        });
      }),
      catchError((error) => {
        console.error('Error creating comment:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update a comment
   * @param commentId The ID of the comment to update
   * @param content The new comment content
   * @returns Observable with the updated comment
   */
  updateComment(commentId: string, content: string): Observable<Comment> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // First check if the user owns this comment
    return from(
      this.supabase
        .from('comments')
        .select('user_id')
        .eq('id', commentId)
        .single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        if (!data) {
          return throwError(() => new Error('Comment not found'));
        }
        if (data.user_id !== userId) {
          return throwError(
            () => new Error('You are not authorized to edit this comment')
          );
        }

        // Update the comment
        return from(
          this.supabase
            .from('comments')
            .update({ content, updated_at: new Date() })
            .eq('id', commentId)
            .select('*, users:user_id(*)')
            .single()
        );
      }),
      map(({ data, error }) => {
        if (error) throw error;
        if (!data) {
          throw new Error('Failed to update comment');
        }
        return this.mapComment(data);
      }),
      catchError((error) => {
        console.error('Error updating comment:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a comment
   * @param commentId The ID of the comment to delete
   * @returns Observable indicating success
   */
  deleteComment(commentId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // First check if the user owns this comment
    return from(
      this.supabase
        .from('comments')
        .select('user_id')
        .eq('id', commentId)
        .single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        if (!data) {
          return throwError(() => new Error('Comment not found'));
        }
        if (data.user_id !== userId) {
          return throwError(
            () => new Error('You are not authorized to delete this comment')
          );
        }

        // Delete the comment
        return from(
          this.supabase.from('comments').delete().eq('id', commentId)
        );
      }),
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => {
        console.error('Error deleting comment:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get comment count for a post
   * @param postId The ID of the post
   * @returns Observable with the comment count
   */
  getCommentCount(postId: string): Observable<number> {
    return from(
      this.supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId)
    ).pipe(
      map(({ count, error }) => {
        if (error) throw error;
        return count || 0;
      }),
      catchError((error) => {
        console.error('Error getting comment count:', error);
        return of(0);
      })
    );
  }

  /**
   * Vote on a comment (upvote or downvote)
   * @param commentId The comment ID
   * @param voteType The type of vote (upvote or downvote)
   * @returns Observable indicating success
   */
  voteOnComment(commentId: string, voteType: VoteType): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // First check if the user has already voted on this comment
    return this.getUserVoteOnComment(commentId).pipe(
      switchMap((existingVote) => {
        if (existingVote === voteType) {
          // If voting the same way, remove the vote
          return this.removeCommentVote(commentId);
        } else if (existingVote) {
          // If changing vote, update the existing vote
          return from(
            this.supabase
              .from('comment_votes')
              .update({ vote_type: voteType })
              .match({ user_id: userId, comment_id: commentId })
          ).pipe(
            map(({ error }) => {
              if (error) throw error;
            })
          );
        } else {
          // If no existing vote, insert a new one
          return from(
            this.supabase.from('comment_votes').insert({
              user_id: userId,
              comment_id: commentId,
              vote_type: voteType,
            })
          ).pipe(
            map(({ error }) => {
              if (error) throw error;
            })
          );
        }
      }),
      catchError((error) => {
        console.error('Error voting on comment:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Remove a vote from a comment
   * @param commentId The comment ID
   * @returns Observable indicating success
   */
  removeCommentVote(commentId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return from(
      this.supabase
        .from('comment_votes')
        .delete()
        .match({ user_id: userId, comment_id: commentId })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => {
        console.error('Error removing vote:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get the user's current vote on a comment
   * @param commentId The comment ID
   * @returns Observable with the vote type or null if no vote
   */
  getUserVoteOnComment(commentId: string): Observable<VoteType | null> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return of(null);
    }

    return from(
      this.supabase
        .from('comment_votes')
        .select('vote_type')
        .match({ user_id: userId, comment_id: commentId })
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          // If no records found, return null
          if (error.code === 'PGRST116') {
            return null;
          }
          throw error;
        }
        return (data?.vote_type as VoteType) || null;
      }),
      catchError((error) => {
        console.error('Error getting user vote:', error);
        return of(null);
      })
    );
  }

  /**
   * Get vote counts for a comment
   * @param commentId The comment ID
   * @returns Observable with upvotes, downvotes, and score
   */
  getCommentVoteCounts(commentId: string): Observable<{
    upvotes: number;
    downvotes: number;
    score: number;
  }> {
    return from(
      this.supabase
        .from('comment_vote_counts')
        .select('*')
        .eq('comment_id', commentId)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          // If no records found, return zeros
          if (error.code === 'PGRST116') {
            return { upvotes: 0, downvotes: 0, score: 0 };
          }
          throw error;
        }
        return {
          upvotes: data?.upvotes || 0,
          downvotes: data?.downvotes || 0,
          score: data?.score || 0,
        };
      }),
      catchError((error) => {
        console.error('Error getting vote counts:', error);
        return of({ upvotes: 0, downvotes: 0, score: 0 });
      })
    );
  }

  /**
   * Helper function to map database row to Comment model
   */
  private mapComment(data: any): Comment {
    // First, make sure we have proper user data
    let userData: ICommentUser | undefined = undefined;

    if (data.users) {
      userData = {
        id: data.users.id,
        username: data.users.username,
        fullName: data.users.full_name,
        avatarUrl: data.users.avatar_url,
        email: data.users.email || '',
      };
    } else if (
      this.authService.user &&
      data.user_id === this.authService.user.id
    ) {
      // If this is the current user's comment and user data isn't included
      userData = {
        id: this.authService.user.id,
        username: this.getUsernameFromAuth() || 'User',
        fullName: this.getFullNameFromAuth() || '',
        avatarUrl: this.getAvatarUrlFromAuth() || '',
        email: this.authService.user.email || '',
      };
    }

    return new Comment({
      id: data.id,
      userId: data.user_id,
      postId: data.post_id,
      parentId: data.parent_id,
      content: data.content,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      user: userData,
      replies: [], // Initialize empty replies array
    } as IComment);
  }

  /**
   * Helper methods to get user info from auth
   */
  private getUsernameFromAuth(): string | null {
    const user = this.authService.user;
    if (!user) return null;

    // Try all possible locations with bracket notation
    return (
      user.user_metadata?.['username'] ||
      // Fallback to email username
      (user.email ? user.email.split('@')[0] : null)
    );
  }

  private getFullNameFromAuth(): string | null {
    const user = this.authService.user;
    if (!user) return null;

    return user.user_metadata?.['full_name'];
  }

  private getAvatarUrlFromAuth(): string | null {
    const user = this.authService.user;
    if (!user) return null;

    return user.user_metadata?.['avatar_url'];
  }

  // Add these methods to src/app/core/services/comment.service.ts

  /**
   * Get comments for a post with pagination and sorting
   * @param postId The ID of the post
   * @param limit Number of comments to fetch
   * @param offset Number of comments to skip
   * @param sortBy Sort order ('top' or 'recent')
   * @returns Observable with array of comments
   */
  getPostComments(
    postId: string,
    limit: number = 5,
    offset: number = 0,
    sortBy: 'top' | 'recent' = 'top'
  ): Observable<Comment[]> {
    // Determine sort order based on parameter
    const sortOrder = sortBy === 'top' ? 'score' : 'created_at';
    const direction = sortBy === 'top' ? 'desc' : 'desc'; // Newer first for 'recent'

    return from(
      this.supabase
        .from('comments')
        .select('*, users:user_id(*)')
        .eq('post_id', postId)
        .is('parent_id', null) // Only get top-level comments
        .order(sortOrder, { ascending: false })

        .range(offset, offset + limit - 1)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data || data.length === 0) return [];

        return data.map((comment) => this.mapComment(comment));
      }),
      catchError((error) => {
        console.error('Error fetching post comments:', error);
        return of([]);
      })
    );
  }

  /**
   * Get comment replies with pagination and sorting
   * @param commentId The ID of the parent comment
   * @param limit Number of replies to fetch
   * @param offset Number of replies to skip
   * @param sortBy Sort order ('top' or 'recent')
   * @returns Observable with array of replies
   */ getCommentReplies(
    commentId: string,
    limit: number = 5,
    offset: number = 0,
    sortBy: 'top' | 'recent' = 'top'
  ): Observable<Comment[]> {
    // Use created_at as the default sort order since score column doesn't exist
    const sortOrder = 'created_at';
    // For recent comments, we typically want newest first
    const ascending = false; // descending order (newest first)

    return from(
      this.supabase
        .from('comments')
        .select('*, users:user_id(*)')
        .eq('parent_id', commentId)
        .order(sortOrder, { ascending })
        .range(offset, offset + limit - 1)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data || data.length === 0) return [];

        return data.map((comment) => this.mapComment(comment));
      }),
      catchError((error) => {
        console.error('Error fetching comment replies:', error);
        return of([]);
      })
    );
  }

  /**
   * Get the number of replies for a comment
   * @param commentId The ID of the parent comment
   * @returns Observable with the count of replies
   */
  getCommentRepliesCount(commentId: string): Observable<number> {
    return from(
      this.supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', commentId)
    ).pipe(
      map(({ count, error }) => {
        if (error) throw error;
        return count || 0;
      }),
      catchError((error) => {
        console.error('Error counting replies:', error);
        return of(0);
      })
    );
  }
}
