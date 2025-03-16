// src/app/core/services/post.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environment';
import { Post } from '../../models';
import { Media } from '../../models';
import { Observable, from, throwError, forkJoin, of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class PostService {
  private supabase: SupabaseClient;

  constructor(private authService: AuthService) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  /**
   * Get a post by ID
   */
  getPost(id: string): Observable<Post> {
    // Makes a single query to fetch a post with its user details
    return from(
      this.supabase
        .from('posts')
        .select(
          `
          *, 
          users:user_id(*),
          shared_post:shared_post_id(*, users:user_id(*))
        `
        )
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;

        const post = this.mapPostFromSupabase(data);

        return post;
      }),
      catchError((error) => throwError(() => error))
    );
  }

  /**
   * Delete a post
   */
  deletePost(id: string): Observable<void> {
    // Deletes a post by ID from the posts table
    return from(this.supabase.from('posts').delete().eq('id', id)).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => throwError(() => error))
    );
  }

  /**
   * Hide a post for the current user
   */
  hidePost(postId: string, userId: string): Observable<void> {
    // Inserts a record into user_hidden_posts to track hidden posts
    return from(
      this.supabase
        .from('user_hidden_posts')
        .insert({ user_id: userId, post_id: postId })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => throwError(() => error))
    );
  }

  /**
   * Save a post for the current user
   */
  savePost(postId: string, userId: string): Observable<void> {
    // Inserts a record into user_saved_posts to bookmark the post
    return from(
      this.supabase
        .from('user_saved_posts')
        .insert({ user_id: userId, post_id: postId })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => throwError(() => error))
    );
  }

  /**
   * Unsave a post for the current user
   */
  unsavePost(postId: string, userId: string): Observable<void> {
    // Removes a record from user_saved_posts
    return from(
      this.supabase
        .from('user_saved_posts')
        .delete()
        .match({ user_id: userId, post_id: postId })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => throwError(() => error))
    );
  }

  /**
   * Unhide a post for the current user
   */
  unhidePost(postId: string, userId: string): Observable<void> {
    // Removes a record from user_hidden_posts
    return from(
      this.supabase
        .from('user_hidden_posts')
        .delete()
        .match({ user_id: userId, post_id: postId })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => throwError(() => error))
    );
  }

  /**
   * Check if a post is saved by the current user
   */
  isPostSaved(postId: string, userId: string): Observable<boolean> {
    // Checks if a record exists in user_saved_posts
    return from(
      this.supabase
        .from('user_saved_posts')
        .select('*')
        .match({ user_id: userId, post_id: postId })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.length > 0;
      }),
      catchError((error) => throwError(() => error))
    );
  }

  /**
   * Check if a post is hidden by the current user
   */
  isPostHidden(postId: string, userId: string): Observable<boolean> {
    // Checks if a record exists in user_hidden_posts
    return from(
      this.supabase
        .from('user_hidden_posts')
        .select('*')
        .match({ user_id: userId, post_id: postId })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.length > 0;
      }),
      catchError((error) => throwError(() => error))
    );
  }

  /**
   * Get all saved posts for a user
   */

  /**
   * Get all saved posts for a user
   */
  getSavedPosts(userId: string): Observable<Post[]> {
    // Improved query to include shared post data
    return from(
      this.supabase
        .from('user_saved_posts')
        .select(
          `
        post_id, 
        posts:post_id(
          *, 
          users:user_id(*),
          shared_post:shared_post_id(*, users:user_id(*))
        )
      `
        )
        .eq('user_id', userId)
        .order('saved_at', { ascending: false })
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;

        if (!data || data.length === 0) {
          return of([]);
        }

        // Map posts from Supabase response
        const posts = data.map((item) => this.mapPostFromSupabase(item.posts));

        // Fetch media for all posts (including shared posts)
        const mediaRequests: Observable<Post>[] = [];

        // Regular post media
        posts.forEach((post) => {
          mediaRequests.push(
            this.getPostMedia(post.id).pipe(
              map((media) => {
                post.media = media;
                return post;
              })
            )
          );

          // Also fetch media for shared posts
          if (post.sharedPostId && post.sharedPost) {
            mediaRequests.push(
              this.getPostMedia(post.sharedPostId).pipe(
                map((media) => {
                  if (post.sharedPost) {
                    post.sharedPost.media = media;
                  }
                  return post;
                })
              )
            );
          }
        });

        return forkJoin(mediaRequests).pipe(
          catchError(() => of(posts)) // Return posts without media if media fetch fails
        );
      }),
      catchError((error) => {
        console.error('Error fetching saved posts:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Share a post - new implementation to create a shared post
   * @param postId The ID of the post to share
   * @param comment Optional comment to add to the shared post
   * @returns Observable with the newly created shared post
   */
  sharePost(postId: string, comment?: string): Observable<Post> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Create a new post that references the original
    const sharedPostData = {
      user_id: userId,
      content: comment || '', // Optional comment
      privacy_level: 'public', // Default to public for shares
      shared_post_id: postId, // Reference to the original post
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return from(
      this.supabase.from('posts').insert(sharedPostData).select('*')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;

        if (!data || data.length === 0) {
          throw new Error('Failed to share post');
        }

        // Convert to Post model
        return new Post({
          id: data[0].id,
          userId: data[0].user_id,
          content: data[0].content,
          privacyLevel: data[0].privacy_level,
          sharedPostId: data[0].shared_post_id,
          createdAt: new Date(data[0].created_at),
          updatedAt: new Date(data[0].updated_at),
        });
      }),
      catchError((error) => {
        console.error('Error sharing post:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get share count for a post
   * @param postId The post ID
   * @returns Observable with the share count
   */
  getPostShareCount(postId: string): Observable<number> {
    return from(
      this.supabase
        .from('post_share_counts')
        .select('count')
        .eq('post_id', postId)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          // If no rows found, return 0
          if (error.code === 'PGRST116') {
            return 0;
          }
          throw error;
        }
        return data?.count || 0;
      }),
      catchError((error) => {
        console.error('Error getting post share count:', error);
        return of(0);
      })
    );
  }

  /**
   * Get a reactive observable for share count
   * @param postId The post ID
   * @returns Observable that updates when share count changes
   */
  getPostShareCountObservable(postId: string): Observable<number> {
    // First fetch the initial count
    this.getPostShareCount(postId).subscribe();

    // Set up a real-time channel for share count updates
    const channel = this.supabase
      .channel(`post-share-count-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_share_counts',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          // When a change occurs, we'll refetch the count
          this.getPostShareCount(postId).subscribe();
        }
      )
      .subscribe();

    // Return the one-time count for now
    // In the future, you could enhance this with a BehaviorSubject
    return this.getPostShareCount(postId);
  }

  /**
   * Get the link for sharing a post externally
   * @param postId Post ID
   * @returns Observable with the shareable link
   */
  getShareableLink(postId: string): Observable<string> {
    const shareableLink = `${window.location.origin}/post/${postId}`;
    return new Observable((observer) => {
      observer.next(shareableLink);
      observer.complete();
    });
  }

  /**
   * Get posts for the home feed - updated to include shared posts
   */
  getHomeFeed(): Observable<Post[]> {
    // Get the current user ID (if logged in)
    const currentUserId = this.authService.user?.id;

    // Build the query based on authentication status
    let query = this.supabase
      .from('posts')
      .select(
        `
        *, 
        users:user_id(*),
        shared_post:shared_post_id(*, users:user_id(*))
      `
      )
      .order('created_at', { ascending: false })
      .limit(20);

    // If user is logged in, add privacy filter
    if (currentUserId) {
      // Show public posts OR user's own posts
      query = query.or(`privacy_level.eq.public,user_id.eq.${currentUserId}`);
    } else {
      // For non-authenticated users, only show public posts
      query = query.eq('privacy_level', 'public');
    }

    // First fetch posts, then fetch media for each post using forkJoin
    return from(query).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;

        // If no posts, return empty array
        if (!data || data.length === 0) {
          return of([]);
        }

        // Map posts from Supabase response
        const posts = data.map((post) => this.mapPostFromSupabase(post));

        // Fetch media for all posts (including shared posts)
        const mediaRequests: Observable<Post>[] = [];

        // Regular post media
        posts.forEach((post) => {
          mediaRequests.push(
            this.getPostMedia(post.id).pipe(
              map((media) => {
                post.media = media;
                return post;
              })
            )
          );

          // Also fetch media for shared posts
          if (post.sharedPostId && post.sharedPost) {
            mediaRequests.push(
              this.getPostMedia(post.sharedPostId).pipe(
                map((media) => {
                  if (post.sharedPost) {
                    post.sharedPost.media = media;
                  }
                  return post;
                })
              )
            );
          }
        });

        return forkJoin(mediaRequests);
      }),
      catchError((error) => {
        console.error('Error fetching home feed:', error);
        return throwError(() => error);
      })
    );
  }

  // Helper method to map Supabase post data to our Post model
  private mapPostFromSupabase(data: any): Post {
    // Create the post object
    const post = new Post({
      id: data.id,
      userId: data.user_id,
      content: data.content,
      privacyLevel: data.privacy_level,
      groupId: data.group_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      user: data.users,
      sharedPostId: data.shared_post_id,
    });

    // Add shared post if it exists
    if (data.shared_post) {
      post.sharedPost = new Post({
        id: data.shared_post.id,
        userId: data.shared_post.user_id,
        content: data.shared_post.content,
        privacyLevel: data.shared_post.privacy_level,
        groupId: data.shared_post.group_id,
        createdAt: new Date(data.shared_post.created_at),
        updatedAt: new Date(data.shared_post.updated_at),
        user: data.shared_post.users,
      });
    }

    return post;
  }

  /**
   * Get media for a specific post
   */
  getPostMedia(postId: string): Observable<Media[]> {
    // Fetches all media attachments for a post, ordered by index
    return from(
      this.supabase
        .from('media')
        .select('*')
        .eq('post_id', postId)
        .order('order_index', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;

        if (!data || data.length === 0) {
          return [];
        }

        return data.map(
          (item) =>
            new Media({
              id: item.id,
              postId: item.post_id,
              messageId: item.message_id,
              url: item.url,
              mediaType: item.media_type,
              orderIndex: item.order_index,
              createdAt: new Date(item.created_at),
            })
        );
      }),
      catchError((error) => {
        console.error(`Error fetching media for post ${postId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a post without media
   */
  createPost(post: Post): Observable<Post> {
    // Creates a basic post without media attachments
    return from(
      this.supabase
        .from('posts')
        .insert({
          user_id: post.userId,
          content: post.content,
          privacy_level: post.privacyLevel,
          created_at: post.createdAt,
          updated_at: post.updatedAt,
        })
        .select('*')
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          // Log the specific error
          console.error('Supabase error creating post:', error);
          throw error;
        }

        if (!data || data.length === 0) {
          throw new Error('No data returned from post creation');
        }

        // Convert to Post model
        return new Post({
          id: data[0].id,
          userId: data[0].user_id,
          content: data[0].content,
          privacyLevel: data[0].privacy_level,
          createdAt: new Date(data[0].created_at),
          updatedAt: new Date(data[0].updated_at),
        });
      }),
      catchError((error) => {
        console.error('Error in createPost:', error);

        // Enhance error with specific code if it's a Supabase error
        if (error.code === '42501') {
          error.isRlsError = true;
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * Add media to an existing post
   */
  addMediaToPost(postId: string, mediaItems: any[]): Observable<void> {
    // Skip if no media items to add
    if (!mediaItems || mediaItems.length === 0) {
      return of(undefined); // Nothing to do
    }

    // Prepare media items for insertion
    const mediaInserts = mediaItems.map((media) => ({
      post_id: postId,
      url: media.url,
      media_type: media.mediaType,
      order_index: media.orderIndex,
    }));

    // Inserts all media items in a single operation
    return from(this.supabase.from('media').insert(mediaInserts)).pipe(
      map(({ error }) => {
        if (error) {
          console.error('Supabase error adding media:', error);
          throw error;
        }
      }),
      catchError((error) => {
        console.error('Error in addMediaToPost:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Upload media file to Supabase storage
   */
  uploadMedia(file: File, fileName: string): Promise<string> {
    const filePath = fileName;

    // Uses the Supabase storage API to upload a file and get its public URL
    return new Promise((resolve, reject) => {
      this.supabase.storage
        .from('post-media') // Make sure this bucket exists in your Supabase project
        .upload(filePath, file)
        .then((response) => {
          if (response.error) {
            console.error('Supabase storage upload error:', response.error);
            reject(response.error);
            return;
          }

          // Get the public URL for the uploaded file
          const { data } = this.supabase.storage
            .from('post-media')
            .getPublicUrl(filePath);

          resolve(data.publicUrl);
        })
        .catch((error) => {
          console.error('Upload error:', error);
          reject(error);
        });
    });
  }

  /**
   * Get posts by username for profile page
   */
  getPostsByUsername(username: string): Observable<Post[]> {
    // First looks up user ID from username, then fetches posts with that user ID
    return from(
      this.supabase.from('users').select('id').eq('username', username).single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        if (!data) return of([]); // User not found

        const userId = data.id;

        // Now get posts by this user ID, including shared posts
        return from(
          this.supabase
            .from('posts')
            .select(
              `
              *, 
              users:user_id(*),
              shared_post:shared_post_id(*, users:user_id(*))
            `
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        );
      }),
      switchMap((response: any) => {
        const { data, error } = response;
        if (error) throw error;
        if (!data || data.length === 0) return of([]);

        // Map posts from Supabase response
        const posts = data.map((post: any) => this.mapPostFromSupabase(post));

        // Fetch media for all posts (including shared posts)
        const mediaRequests: Observable<Post>[] = [];

        // Regular post media
        posts.forEach((post: any) => {
          mediaRequests.push(
            this.getPostMedia(post.id).pipe(
              map((media) => {
                post.media = media;
                return post;
              })
            )
          );

          // Also fetch media for shared posts
          if (post.sharedPostId && post.sharedPost) {
            mediaRequests.push(
              this.getPostMedia(post.sharedPostId).pipe(
                map((media) => {
                  if (post.sharedPost) {
                    post.sharedPost.media = media;
                  }
                  return post;
                })
              )
            );
          }
        });

        return forkJoin(mediaRequests).pipe(
          catchError(() => of(posts)) // Return posts without media if media fetch fails
        );
      }),
      catchError((error) => {
        console.error('Error fetching posts by username:', error);
        return of([]);
      })
    );
  }
}
