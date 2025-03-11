// src/app/core/services/user.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environment';
import { Observable, from, throwError, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { User, IUser } from '../../models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private supabase: SupabaseClient;

  constructor(private authService: AuthService) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  /**
   * Get a user by username
   * @param username The username to search for
   * @returns Observable with the user
   */
  getUserByUsername(username: string): Observable<User | null> {
    return from(
      this.supabase.from('users').select('*').eq('username', username).single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned - user not found
            return null;
          }
          throw error;
        }

        if (!data) return null;

        return new User({
          id: data.id,
          username: data.username,
          email: data.email,
          fullName: data.full_name,
          avatarUrl: data.avatar_url,
          bio: data.bio,
          theme: data.theme || 'light',
          privacySettings: data.privacy_settings || {
            postsVisibility: 'public',
            profileVisibility: 'public',
          },
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        } as IUser);
      }),
      catchError((error) => {
        console.error('Error fetching user by username:', error);
        return of(null);
      })
    );
  }

  /**
   * Update a user's profile
   * @param userId The user ID
   * @param userData The data to update
   */
  updateUserProfile(
    userId: string,
    userData: Partial<IUser>
  ): Observable<User | null> {
    // Convert from camelCase to snake_case for Supabase
    const supabaseData = {
      username: userData.username,
      full_name: userData.fullName,
      avatar_url: userData.avatarUrl,
      bio: userData.bio,
      theme: userData.theme,
      privacy_settings: userData.privacySettings,
      updated_at: new Date(),
    };

    return from(
      this.supabase.from('users').update(supabaseData).eq('id', userId).select()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;

        if (!data || !data[0]) return null;

        const userData = data[0];
        return new User({
          id: userData.id,
          username: userData.username,
          email: userData.email,
          fullName: userData.full_name,
          avatarUrl: userData.avatar_url,
          bio: userData.bio,
          theme: userData.theme,
          privacySettings: userData.privacy_settings,
          createdAt: new Date(userData.created_at),
          updatedAt: new Date(userData.updated_at),
        } as IUser);
      }),
      catchError((error) => {
        console.error('Error updating user profile:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get the current user's profile
   * @returns Observable with the user
   */
  getCurrentUserProfile(): Observable<User | null> {
    const currentUser = this.authService.user;
    if (!currentUser) {
      return of(null);
    }

    return from(
      this.supabase.from('users').select('*').eq('id', currentUser.id).single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;

        if (!data) return null;

        return new User({
          id: data.id,
          username: data.username,
          email: data.email,
          fullName: data.full_name,
          avatarUrl: data.avatar_url,
          bio: data.bio,
          theme: data.theme || 'light',
          privacySettings: data.privacy_settings || {
            postsVisibility: 'public',
            profileVisibility: 'public',
          },
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        } as IUser);
      }),
      catchError((error) => {
        console.error('Error fetching current user profile:', error);
        return of(null);
      })
    );
  }
}
