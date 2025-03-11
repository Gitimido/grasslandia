// src/app/core/services/post.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environment';
import { Post } from '../../models';
import { Media } from '../../models';
import { Observable, from, throwError, forkJoin, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
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
   * TODO: May be important later ( but never use this in iteration as will increae load on database )
   * TODO: better approach is handle post search by indecies from database itself
   * Get a post by ID
   *
   * Used by:
   * - No direct component usage (potential usage in PostDetailComponent)
   *
   * @param id Post ID
   * @returns Observable with the post
   */
  getPost(id: string): Observable<Post> {
    // Makes a single query to fetch a post with its user details
    return from(
      this.supabase
        .from('posts')
        .select('*, users(username, avatar_url, full_name)')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Post;
      }),
      catchError((error) => throwError(() => error))
    );
  }

  /**
   * Delete a post
   *
   * Used by:
   * - PostCardComponent (src/app/components/post-card/post-card.component.ts)
   *
   * @param id Post ID to delete
   * @returns Observable with success status
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
   *
   * Used by:
   * - PostCardComponent (src/app/components/post-card/post-card.component.ts)
   *
   * @param postId Post ID to hide
   * @param userId Current user ID
   * @returns Observable with success status
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
   *
   * Used by:
   * - PostCardComponent (src/app/components/post-card/post-card.component.ts)
   *
   * @param postId Post ID to save
   * @param userId Current user ID
   * @returns Observable with success status
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
   *
   * Used by:
   * - PostCardComponent (src/app/components/post-card/post-card.component.ts)
   *
   * @param postId Post ID to unsave
   * @param userId Current user ID
   * @returns Observable with success status
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
   *
   * Used by:
   * - No direct component usage
   *
   * @param postId Post ID to unhide
   * @param userId Current user ID
   * @returns Observable with success status
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
   *
   * Used by:
   * - PostCardComponent (src/app/components/post-card/post-card.component.ts)
   *
   * @param postId Post ID to check
   * @param userId Current user ID
   * @returns Observable with boolean indicating if post is saved
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
   *
   * Used by:
   * - No direct component usage
   *
   * @param postId Post ID to check
   * @param userId Current user ID
   * @returns Observable with boolean indicating if post is hidden
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
   *
   * Used by:
   * - No direct component usage (potential usage in Bookmarks page)
   *
   * @param userId User ID
   * @returns Observable with array of saved posts
   */
  getSavedPosts(userId: string): Observable<Post[]> {
    // Retrieves all saved posts with a join on the posts table
    return from(
      this.supabase
        .from('user_saved_posts')
        .select('post_id, posts(*)')
        .eq('user_id', userId)
        .order('saved_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map((item) => item.posts) as unknown as Post[];
      }),
      catchError((error) => throwError(() => error))
    );
  }

  /**
   * Share a post (generates a shareable link)
   *
   * Used by:
   * - PostCardComponent (src/app/components/post-card/post-card.component.ts)
   *
   * @param postId Post ID to share
   * @returns Observable with shareable link
   */
  sharePost(postId: string): Observable<string> {
    // Generates a shareable link with the current domain and post ID
    const shareableLink = `${window.location.origin}/post/${postId}`;
    return new Observable((observer) => {
      observer.next(shareableLink);
      observer.complete();
    });
  }

  /**
   * Get posts for the home feed
   *
   * Used by:
   * - FeedComponent (src/app/components/feed/feed.component.ts)
   *
   * @returns Observable with array of posts
   */
  getHomeFeed(): Observable<Post[]> {
    // Get the current user ID (if logged in)
    const currentUserId = this.authService.user?.id;

    // Build the query based on authentication status
    let query = this.supabase
      .from('posts')
      .select('*, users:user_id(*)')
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

        // Create an array of posts
        const posts = data.map((post) => {
          return new Post({
            id: post.id,
            userId: post.user_id,
            content: post.content,
            privacyLevel: post.privacy_level,
            groupId: post.group_id,
            createdAt: new Date(post.created_at),
            updatedAt: new Date(post.updated_at),
            user: post.users,
          });
        });

        // Now fetch media for each post and merge it
        const postWithMediaRequests = posts.map((post) => {
          return this.getPostMedia(post.id).pipe(
            map((media) => {
              post.media = media;
              return post;
            })
          );
        });

        return forkJoin(postWithMediaRequests);
      }),
      catchError((error) => {
        console.error('Error fetching home feed:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get media for a specific post
   *
   * Used by:
   * - Used internally by getHomeFeed and getPostsByUsername
   *
   * @param postId Post ID
   * @returns Observable with array of media items
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
   * TODO: This need to be implemented inside the post inside of diffrenet method
   * Create a post with attached media
   *
   * Used by:
   * - No direct component usage (legacy method)
   *
   * @param post Post object to create
   * @param mediaItems Media items to attach
   * @returns Observable with created post
   */
  createPostWithMedia(post: Post, mediaItems: Media[]): Observable<Post> {
    // First creates the post, then attaches media items in a transaction-like flow
    return from(
      this.supabase
        .from('posts')
        .insert({
          id: post.id,
          user_id: post.userId,
          content: post.content,
          privacy_level: post.privacyLevel,
          created_at: post.createdAt,
          updated_at: post.updatedAt,
        })
        .select()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;

        if (!data || data.length === 0) {
          throw new Error('Failed to create post');
        }

        // Now insert all media items
        const mediaInserts = mediaItems.map((media) => ({
          id: media.id,
          post_id: media.postId,
          url: media.url,
          media_type: media.mediaType,
          order_index: media.orderIndex,
          created_at: media.createdAt,
        }));

        return from(this.supabase.from('media').insert(mediaInserts).select());
      }),
      switchMap(({ data, error }) => {
        if (error) throw error;

        // Now fetch the complete post with media
        return this.getPost(post.id);
      }),
      catchError((error) => {
        console.error('Error creating post with media:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a post without media
   *
   * Used by:
   * - CreatePostComponent (src/app/components/create-post/create-post.component.ts)
   *
   * @param post Post object to create
   * @returns Observable with created post
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
   *
   * Used by:
   * - CreatePostComponent (src/app/components/create-post/create-post.component.ts)
   *
   * @param postId Post ID to add media to
   * @param mediaItems Media items to add
   * @returns Observable indicating success
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
   *
   * Used by:
   * - CreatePostComponent (src/app/components/create-post/create-post.component.ts)
   *
   * @param file File to upload
   * @param fileName Name to save the file as
   * @returns Promise with the public URL of the uploaded file
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
   *
   * Used by:
   * - ProfileComponent (src/app/pages/profile/profile.component.ts)
   *
   * @param username The username to fetch posts for
   * @returns Observable with array of posts
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

        // Now get posts by this user ID
        return from(
          this.supabase
            .from('posts')
            .select('*, users:user_id(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        );
      }),
      switchMap((response: any) => {
        const { data, error } = response;
        if (error) throw error;
        if (!data || data.length === 0) return of([]);

        // Create array of posts
        const posts = data.map(
          (post: any) =>
            new Post({
              id: post.id,
              userId: post.user_id,
              content: post.content,
              privacyLevel: post.privacy_level,
              groupId: post.group_id,
              createdAt: new Date(post.created_at),
              updatedAt: new Date(post.updated_at),
              user: post.users,
            })
        );

        // Get media for each post using forkJoin for parallel requests
        const postWithMediaRequests = posts.map((post: any) =>
          this.getPostMedia(post.id).pipe(
            map((media) => {
              post.media = media;
              return post;
            })
          )
        );

        return forkJoin(postWithMediaRequests).pipe(
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
