import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, throwError, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environment';
import { AuthService } from './auth.service';
import { Media, IMedia } from '../../models';

export enum MediaCategory {
  PROFILE = 'profile',
  POST = 'post',
}

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private supabase: SupabaseClient;
  // Use your actual Cloudflare worker URL
  private apiUrl =
    'https://grasslandia-mediahandling.mohamedhazem789.workers.dev/api/media/upload';

  constructor(private http: HttpClient, private authService: AuthService) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  /**
   * Upload media to Cloudflare R2 via the Worker API
   * @param file The file to upload
   * @param category The category (profile or post)
   * @param postId Optional post ID if category is post
   * @returns Observable with the uploaded media details
   */
  uploadMedia(
    file: File,
    category: MediaCategory,
    postId?: string
  ): Observable<Media> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    if (category === MediaCategory.POST && !postId) {
      return throwError(() => new Error('Post ID is required for post media'));
    }

    // Create FormData for the upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('mediaCategory', category);

    if (postId) {
      formData.append('postId', postId);
    }

    // Add the media type based on file type
    const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
    formData.append('mediaType', mediaType);

    // Upload to our Cloudflare worker endpoint
    return this.http.post<any>(this.apiUrl, formData).pipe(
      map((response) => {
        if (!response.success) {
          throw new Error(response.error || 'Upload failed');
        }

        // Create a Media object from the response
        return new Media({
          id: response.fileId || 'temp-' + Date.now(),
          url: response.url,
          mediaType: response.mediaType,
          postId: postId,
          orderIndex: 0,
          createdAt: new Date(),
        });
      }),
      catchError((error) => {
        console.error('Error uploading media:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Upload a profile picture
   * @param file The profile image to upload
   * @returns Observable with the uploaded media details
   */
  uploadProfilePicture(file: File): Observable<Media> {
    return this.uploadMedia(file, MediaCategory.PROFILE);
  }

  /**
   * Upload post media
   * @param file The media file to upload
   * @param postId The post ID to associate the media with
   * @returns Observable with the uploaded media details
   */
  uploadPostMedia(file: File, postId: string): Observable<Media> {
    return this.uploadMedia(file, MediaCategory.POST, postId);
  }

  /**
   * Upload multiple post media files
   * @param files Array of files to upload
   * @param postId The post ID
   * @returns Observable with array of media items
   */
  uploadMultiplePostMedia(files: File[], postId: string): Observable<Media[]> {
    if (!files || files.length === 0) {
      return of([]);
    }

    const uploadObservables = files.map((file, index) =>
      this.uploadPostMedia(file, postId).pipe(
        // Update order index based on position in array
        switchMap((media) =>
          from(
            this.supabase
              .from('media')
              .update({ order_index: index })
              .eq('id', media.id)
          ).pipe(
            map(() => {
              media.orderIndex = index;
              return media;
            })
          )
        )
      )
    );

    return forkJoin(uploadObservables);
  }

  /**
   * Get media for a user's profile
   * @param userId The user ID
   * @returns Observable with the latest profile media
   */
  getUserProfileMedia(userId: string): Observable<Media | null> {
    return from(
      this.supabase
        .from('media')
        .select('*')
        .eq('user_id', userId)
        .is('post_id', null) // Profile media don't have post_id
        .order('created_at', { ascending: false })
        .limit(1)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data || data.length === 0) return null;

        return new Media({
          id: data[0].id,
          postId: data[0].post_id,
          messageId: data[0].message_id,
          url: data[0].url,
          mediaType: data[0].media_type,
          orderIndex: data[0].order_index,
          createdAt: new Date(data[0].created_at),
        });
      }),
      catchError((error) => {
        console.error('Error getting profile media:', error);
        return of(null);
      })
    );
  }

  /**
   * Get media for a post
   * @param postId The post ID
   * @returns Observable with array of media items
   */
  getPostMedia(postId: string): Observable<Media[]> {
    return from(
      this.supabase
        .from('media')
        .select('*')
        .eq('post_id', postId)
        .order('order_index', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data || data.length === 0) return [];

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
        console.error('Error getting post media:', error);
        return of([]);
      })
    );
  }

  /**
   * Delete a media item
   * @param mediaId The media ID to delete
   * @returns Observable confirming deletion
   */
  deleteMedia(mediaId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // First get the media details to know what to delete from storage
    return from(
      this.supabase.from('media').select('*').eq('id', mediaId).single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error('Media not found');

        // Check ownership
        if (data.user_id !== userId) {
          throw new Error('You do not have permission to delete this media');
        }

        // Delete from Supabase first
        return from(this.supabase.from('media').delete().eq('id', mediaId));
      }),
      map(({ error }) => {
        if (error) throw error;
        // We don't actually delete from R2 here as we don't have an API for that
        return;
      }),
      catchError((error) => {
        console.error('Error deleting media:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update the order of media items
   * @param mediaIds Array of media IDs in the desired order
   * @returns Observable confirming update
   */
  updateMediaOrder(mediaIds: string[]): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    // Create an array of updates
    const updates = mediaIds.map((id, index) => {
      return this.supabase
        .from('media')
        .update({ order_index: index })
        .eq('id', id)
        .eq('user_id', userId); // Ensure user owns this media
    });

    // Execute all updates in parallel
    return from(Promise.all(updates)).pipe(
      map(() => void 0),
      catchError((error) => {
        console.error('Error updating media order:', error);
        return throwError(() => error);
      })
    );
  }
}
