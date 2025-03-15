// src/app/core/services/comment.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from '@supabase/supabase-js';
import {
  Observable,
  from,
  throwError,
  of,
  forkJoin,
  BehaviorSubject,
} from 'rxjs';
import { map, catchError, switchMap, finalize, tap } from 'rxjs/operators';
import { environment } from '../../../environment';
import { AuthService } from './auth.service';
import { Comment } from '../../models';
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

  // Track loaded comments for better state management
  private loadedCommentIds = new Set<string>();

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

  private setupRealtimeSubscription(): void {
    // Clean up existing subscription
    this.cleanupSubscription();

    // Subscribe to comments table changes
    this.commentsSubscription = this.supabase
      .channel('comments-public')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'comments',
          // No filters - listen to all comment changes
        },
        (payload) => {
          console.log('Comment change detected:', payload);

          if (payload.eventType === 'INSERT') {
            // Get additional user data for the comment
            this.enrichCommentWithUserData(payload.new).subscribe((comment) => {
              // Track this comment as loaded
              this.loadedCommentIds.add(comment.id);

              // Dispatch to store
              this.store.dispatch(CommentsActions.commentAdded({ comment }));
            });
          } else if (payload.eventType === 'UPDATE') {
            // Get additional user data for the comment
            this.enrichCommentWithUserData(payload.new).subscribe((comment) => {
              this.store.dispatch(CommentsActions.commentUpdated({ comment }));
            });
          } else if (payload.eventType === 'DELETE') {
            this.store.dispatch(
              CommentsActions.commentDeleted({
                commentId: payload.old['id'],
                postId: payload.old['post_id'],
                parentId: payload.old['parent_id'],
              })
            );

            // Remove from tracking
            this.loadedCommentIds.delete(payload.old['id']);
          }
        }
      )
      .subscribe((status) => {
        console.log('Comments channel status:', status);
      });
  }

  private cleanupSubscription(): void {
    if (this.commentsSubscription) {
      this.supabase.removeChannel(this.commentsSubscription);
      this.commentsSubscription = null;
    }

    // Reset tracking
    this.loadedCommentIds.clear();
  }

  // Helper to enrich a comment with user data
  private enrichCommentWithUserData(commentData: any): Observable<any> {
    // For safety, check if we have the necessary data
    if (!commentData || !commentData.user_id) {
      console.error('Invalid comment data:', commentData);
      return of(null);
    }

    return from(
      this.supabase
        .from('users')
        .select('id, username, full_name, avatar_url, email')
        .eq('id', commentData.user_id)
        .single()
        .then(
          ({ data: userData, error }) => {
            if (error) {
              console.error('Error fetching user data for comment:', error);
              // Return a basic comment even without user data
              return this.mapComment({
                ...commentData,
                users: null,
              });
            }

            // Return comment with user data
            return this.mapComment({
              ...commentData,
              users: userData,
            });
          },
          (error: any) => {
            console.error('Error in enrichCommentWithUserData:', error);
            // Return a basic comment as fallback
            return this.mapComment(commentData);
          }
        )
    );
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
      switchMap(({ data, error }) => {
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Failed to create comment');
        }

        // Now fetch user data to include with the comment
        return from(
          this.supabase
            .from('users')
            .select('id, username, full_name, avatar_url, email')
            .eq('id', userId)
            .single()
        ).pipe(
          map(({ data: userData, error: userError }) => {
            if (userError) throw userError;

            // Create userData object with proper types
            const commentUser = {
              id: userId,
              username:
                userData?.username || this.getUsernameFromAuth() || 'User',
              fullName: userData?.full_name || this.getFullNameFromAuth() || '',
              avatarUrl:
                userData?.avatar_url || this.getAvatarUrlFromAuth() || '',
              email: userData?.email || this.authService.user?.email || '',
            };

            // Map the data to a comment with the user data
            const newComment = this.mapComment({
              ...data[0],
              users: commentUser,
            });

            // Dispatch success action with created comment
            this.store.dispatch(
              CommentsActions.createCommentSuccess({
                comment: newComment,
              })
            );

            return newComment;
          })
        );
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
    const sortOrder = 'created_at';
    const direction = 'desc'; // Always show newest first for better UX

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

        const comments = data.map((comment) => {
          // Track this comment as loaded
          this.loadedCommentIds.add(comment.id);
          return this.mapComment(comment);
        });

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
   * Get comment replies with improved error handling and tracking
   */
  getCommentReplies(
    commentId: string,
    limit: number = 5,
    offset: number = 0,
    sortBy: 'top' | 'recent' = 'top'
  ): Observable<Comment[]> {
    // Dispatch action to load replies
    this.store.dispatch(CommentsActions.loadReplies({ commentId }));

    const sortOrder = 'created_at';
    const ascending = false; // descending order (newest first)

    console.log(
      `Fetching replies for comment ${commentId}, limit: ${limit}, offset: ${offset}`
    );

    return from(
      // Use promise-based approach for better error handling
      this.supabase
        .from('comments')
        .select('*, users:user_id(*)')
        .eq('parent_id', commentId)
        .order(sortOrder, { ascending })
        .range(offset, offset + limit - 1)
        .then(
          ({ data, error }) => {
            if (error) {
              console.error('Supabase error fetching replies:', error);
              throw error;
            }

            if (!data || data.length === 0) {
              console.log(`No replies found for comment ${commentId}`);
              // Still dispatch success with empty array
              this.store.dispatch(
                CommentsActions.loadRepliesSuccess({
                  commentId,
                  replies: [],
                })
              );
              return [];
            }

            console.log(
              `Found ${data.length} replies for comment ${commentId}`
            );

            // Process the replies
            const replies = data.map((comment) => {
              // Track this comment as loaded
              this.loadedCommentIds.add(comment.id);
              return this.mapComment(comment);
            });

            // Dispatch success action
            this.store.dispatch(
              CommentsActions.loadRepliesSuccess({
                commentId,
                replies,
              })
            );

            return replies;
          },
          (error) => {
            console.error(
              `Error fetching replies for comment ${commentId}:`,
              error
            );

            // Dispatch failure action
            this.store.dispatch(
              CommentsActions.loadRepliesFailure({
                error: 'Failed to load replies',
              })
            );

            return [];
          }
        )
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

                // Remove from our tracking
                this.loadedCommentIds.delete(commentId);

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
    let userData: any | undefined = undefined;

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
