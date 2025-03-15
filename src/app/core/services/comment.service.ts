// src/app/core/services/comment.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from '@supabase/supabase-js';
import { Observable, from, throwError, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap, finalize, tap } from 'rxjs/operators';
import { environment } from '../../../environment';
import { AuthService } from './auth.service';
import { Comment, VoteType, ICommentUser } from '../../models';
import { Store } from '@ngrx/store';

// Import comment actions and selectors
import * as CommentsActions from '../store/Comments/comments.actions';
import {
  selectPostComments,
  selectCommentReplies,
} from '../store/Comments/comments.selectors';

@Injectable({
  providedIn: 'root',
})
export class CommentService implements OnDestroy {
  private supabase: SupabaseClient;
  private commentsSubscription: RealtimeChannel | null = null;

  constructor(private authService: AuthService, private store: Store) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

    // Set up real-time subscription when user auth changes
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

  // Setup real-time subscription for comments
  private setupRealtimeSubscription(): void {
    // Clean up existing subscription
    this.cleanupSubscription();

    // Subscribe to comments table changes
    this.commentsSubscription = this.supabase
      .channel('comments-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
        },
        (payload) => {
          console.log('Comment created:', payload);
          // Map to comment model and dispatch action
          const newComment = this.mapCommentFromPayload(payload.new);
          this.store.dispatch(
            CommentsActions.commentAdded({ comment: newComment })
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
        },
        (payload) => {
          console.log('Comment updated:', payload);
          const updatedComment = this.mapCommentFromPayload(payload.new);
          this.store.dispatch(
            CommentsActions.commentUpdated({ comment: updatedComment })
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
        },
        (payload) => {
          console.log('Comment deleted:', payload);
          this.store.dispatch(
            CommentsActions.commentDeleted({
              commentId: payload.old['id'],
              postId: payload.old['post_id'],
              parentId: payload.old['parent_id'],
            })
          );
        }
      )
      .subscribe();

    // Also subscribe to comment_votes for real-time voting
    this.supabase
      .channel('comment-votes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comment_votes',
        },
        (payload) => {
          // When votes change, we don't have enough information in the payload
          // to update vote counts directly. Instead, fetch the new vote counts for the comment.
          const commentId =
            payload.new && 'comment_id' in payload.new
              ? payload.new['comment_id']
              : payload.old && 'comment_id' in payload.old
              ? payload.old['comment_id']
              : null;

          if (commentId) {
            this.getCommentVoteCounts(commentId).subscribe((counts) => {
              // Update comment with new vote counts by dispatching an update action
              this.getComment(commentId).subscribe((comment) => {
                if (comment) {
                  const updatedComment = {
                    ...comment,
                    upvotes: counts.upvotes,
                    downvotes: counts.downvotes,
                    score: counts.score,
                  };
                  this.store.dispatch(
                    CommentsActions.commentUpdated({ comment: updatedComment })
                  );
                }
              });
            });
          }
        }
      )
      .subscribe();
  }

  private cleanupSubscription(): void {
    if (this.commentsSubscription) {
      this.supabase.removeChannel(this.commentsSubscription);
      this.commentsSubscription = null;
    }
  }

  // Helper to map Supabase comment data to Comment model
  private mapCommentFromPayload(data: any): any {
    return {
      id: data['id'],
      userId: data['user_id'],
      postId: data['post_id'],
      parentId: data['parent_id'],
      content: data['content'],
      createdAt: new Date(data['created_at']),
      updatedAt: new Date(data['updated_at']),
    };
  }

  // Fetch a single comment by ID
  getComment(commentId: string): Observable<any> {
    return from(
      this.supabase
        .from('comments')
        .select('*, users:user_id(*)')
        .eq('id', commentId)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data) return null;

        return this.mapComment(data);
      }),
      catchError((error) => {
        console.error('Error fetching comment:', error);
        return of(null);
      })
    );
  }

  /**
   * Create a new comment (now using store)
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

    // Dispatch action to notify store that we're creating a comment
    this.store.dispatch(
      CommentsActions.createComment({
        postId,
        content,
        parentId,
      })
    );

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
        const newComment = this.mapComment({
          ...data[0],
          users: userData, // Using 'users' to match expected format in mapComment
        });

        // Dispatch success action with created comment
        this.store.dispatch(
          CommentsActions.createCommentSuccess({
            comment: newComment,
          })
        );

        return newComment;
      }),
      catchError((error) => {
        console.error('Error creating comment:', error);

        // Dispatch failure action
        this.store.dispatch(
          CommentsActions.createCommentFailure({
            error: error.message || 'Failed to create comment',
          })
        );

        return throwError(() => error);
      })
    );
  }

  /**
   * Get comments for a post (now using store)
   */
  getPostComments(
    postId: string,
    limit: number = 5,
    offset: number = 0,
    sortBy: 'top' | 'recent' = 'top'
  ): Observable<Comment[]> {
    // Dispatch action to load comments
    this.store.dispatch(CommentsActions.loadComments({ postId }));

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

        const comments = data.map((comment) => this.mapComment(comment));

        // Dispatch success action
        this.store.dispatch(
          CommentsActions.loadCommentsSuccess({
            postId,
            comments,
          })
        );

        return comments;
      }),
      catchError((error) => {
        console.error('Error fetching post comments:', error);

        // Dispatch failure action
        this.store.dispatch(
          CommentsActions.loadCommentsFailure({
            error: 'Failed to load comments',
          })
        );

        return of([]);
      })
    );
  }

  /**
   * Get comment replies (now using store)
   */
  getCommentReplies(
    commentId: string,
    limit: number = 5,
    offset: number = 0,
    sortBy: 'top' | 'recent' = 'top'
  ): Observable<Comment[]> {
    // Dispatch action to load replies
    this.store.dispatch(CommentsActions.loadReplies({ commentId }));

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

        const replies = data.map((comment) => this.mapComment(comment));

        // Dispatch success action
        this.store.dispatch(
          CommentsActions.loadRepliesSuccess({
            commentId,
            replies,
          })
        );

        return replies;
      }),
      catchError((error) => {
        console.error('Error fetching comment replies:', error);

        // Dispatch failure action
        this.store.dispatch(
          CommentsActions.loadRepliesFailure({
            error: 'Failed to load replies',
          })
        );

        return of([]);
      })
    );
  }

  /**
   * Update a comment
   */
  updateComment(commentId: string, content: string): Observable<Comment> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Dispatch action
    this.store.dispatch(
      CommentsActions.updateComment({
        commentId,
        content,
      })
    );

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
          throw new Error('Comment not found');
        }
        if (data['user_id'] !== userId) {
          throw new Error('You are not authorized to edit this comment');
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

        const updatedComment = this.mapComment(data);

        // Dispatch success action
        this.store.dispatch(
          CommentsActions.updateCommentSuccess({
            comment: updatedComment,
          })
        );

        return updatedComment;
      }),
      catchError((error) => {
        console.error('Error updating comment:', error);

        // Dispatch failure action
        this.store.dispatch(
          CommentsActions.updateCommentFailure({
            error: error.message || 'Failed to update comment',
          })
        );

        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a comment
   */
  deleteComment(commentId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // First get comment details so we know the post and parent IDs
    return this.getComment(commentId).pipe(
      switchMap((comment) => {
        if (!comment) {
          throw new Error('Comment not found');
        }

        const postId = comment.postId;
        const parentId = comment.parentId;

        // Dispatch action
        this.store.dispatch(
          CommentsActions.deleteComment({
            commentId,
            postId,
            parentId,
          })
        );

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
              throw new Error('Comment not found');
            }
            if (data['user_id'] !== userId) {
              throw new Error('You are not authorized to delete this comment');
            }

            // Delete the comment
            return from(
              this.supabase.from('comments').delete().eq('id', commentId)
            ).pipe(
              map(({ error }) => {
                if (error) throw error;

                // Dispatch success action
                this.store.dispatch(
                  CommentsActions.deleteCommentSuccess({
                    commentId,
                    postId,
                    parentId,
                  })
                );
              })
            );
          })
        );
      }),
      catchError((error) => {
        console.error('Error deleting comment:', error);

        // Dispatch failure action
        this.store.dispatch(
          CommentsActions.deleteCommentFailure({
            error: error.message || 'Failed to delete comment',
          })
        );

        return throwError(() => error);
      })
    );
  }

  /**
   * Vote on a comment
   */
  voteOnComment(commentId: string, voteType: VoteType): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Dispatch action
    this.store.dispatch(
      CommentsActions.voteComment({
        commentId,
        voteType,
      })
    );

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

              // Dispatch success action
              this.store.dispatch(
                CommentsActions.voteCommentSuccess({
                  commentId,
                  voteType,
                })
              );
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

              // Dispatch success action
              this.store.dispatch(
                CommentsActions.voteCommentSuccess({
                  commentId,
                  voteType,
                })
              );
            })
          );
        }
      }),
      catchError((error) => {
        console.error('Error voting on comment:', error);

        // Dispatch failure action
        this.store.dispatch(
          CommentsActions.voteCommentFailure({
            error: error.message || 'Failed to vote on comment',
          })
        );

        return throwError(() => error);
      })
    );
  }

  // Keep methods for getting user vote and comment counts
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
        return (data?.['vote_type'] as VoteType) || null;
      }),
      catchError((error) => {
        console.error('Error getting user vote:', error);
        return of(null);
      })
    );
  }

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
          upvotes: data?.['upvotes'] || 0,
          downvotes: data?.['downvotes'] || 0,
          score: data?.['score'] || 0,
        };
      }),
      catchError((error) => {
        console.error('Error getting vote counts:', error);
        return of({ upvotes: 0, downvotes: 0, score: 0 });
      })
    );
  }

  private removeCommentVote(commentId: string): Observable<void> {
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

        // Dispatch success action with null vote type to indicate removal
        this.store.dispatch(
          CommentsActions.voteCommentSuccess({
            commentId,
            voteType: null,
          })
        );
      }),
      catchError((error) => {
        console.error('Error removing vote:', error);

        // Dispatch failure action
        this.store.dispatch(
          CommentsActions.voteCommentFailure({
            error: error.message || 'Failed to remove vote',
          })
        );

        return throwError(() => error);
      })
    );
  }

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

  // Helper methods to get user info from auth
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

  // Helper function to map database row to Comment model
  private mapComment(data: any): Comment {
    // First, make sure we have proper user data
    let userData: ICommentUser | undefined = undefined;

    if (data.users) {
      userData = {
        id: data.users['id'],
        username: data.users['username'],
        fullName: data.users['full_name'],
        avatarUrl: data.users['avatar_url'],
        email: data.users['email'] || '',
      };
    } else if (
      this.authService.user &&
      data['user_id'] === this.authService.user.id
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
      id: data['id'],
      userId: data['user_id'],
      postId: data['post_id'],
      parentId: data['parent_id'],
      content: data['content'],
      createdAt: new Date(data['created_at']),
      updatedAt: new Date(data['updated_at']),
      user: userData,
      replies: [], // Initialize empty replies array
    });
  }
}
