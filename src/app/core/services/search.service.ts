import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environment';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Post, User } from '../../models';

export interface SearchResult {
  type: 'user' | 'post';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  content?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  /**
   * Search for users by username or full name
   * Used for autocomplete suggestions
   */
  searchUsers(query: string, limit: number = 5): Observable<User[]> {
    if (!query || query.length < 2) {
      return of([]);
    }

    return from(
      this.supabase
        .from('users')
        .select('id, username, full_name, avatar_url')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(limit)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data) return [];

        // Convert each result to a User object
        return data.map(
          (user) =>
            new User({
              id: user.id,
              username: user.username,
              fullName: user.full_name,
              avatarUrl: user.avatar_url,
              email: '', // We don't need to expose emails in search results
              theme: 'light', // Default
              privacySettings: {
                postsVisibility: 'public',
                profileVisibility: 'public',
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            })
        );
      }),
      catchError((error) => {
        console.error('Error searching users:', error);
        return of([]);
      })
    );
  }

  /**
   * Full text search for posts
   */
  searchPosts(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Observable<Post[]> {
    if (!query || query.length < 2) {
      return of([]);
    }

    // Create a normalized query for full text search
    const searchQuery = query
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => term + ':*')
      .join(' & ');

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
        .textSearch('search_vector', searchQuery)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data) return [];

        // Convert to Post objects
        return data.map((post) => this.mapPostFromSupabase(post));
      }),
      catchError((error) => {
        console.error('Error searching posts:', error);
        return of([]);
      })
    );
  }

  /**
   * Combined search for the search results page
   */
  /**
   * Combined search for the search results page
   */
  searchAll(query: string, limit: number = 10): Observable<SearchResult[]> {
    if (!query || query.length < 2) {
      return of([]);
    }

    // Normalize the query for full text search
    const searchQuery = query
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => term + ':*')
      .join(' & ');

    const userSearch = this.supabase
      .from('users')
      .select('id, username, full_name, avatar_url')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(5);

    const postSearch = this.supabase
      .from('posts')
      .select(
        `
        id, content, created_at,
        users:user_id(id, username, avatar_url)
      `
      )
      .textSearch('search_vector', searchQuery)
      .limit(5);

    return from(Promise.all([userSearch, postSearch])).pipe(
      map(([userResults, postResults]) => {
        const users = userResults.data || [];
        const posts = postResults.data || [];

        // Map each user result individually
        const userSearchResults: SearchResult[] = users.map((user) => ({
          type: 'user',
          id: user.id,
          title: user.full_name || user.username,
          subtitle: '@' + user.username,
          imageUrl: user.avatar_url,
        }));

        // Map each post result individually
        const postSearchResults: SearchResult[] = posts.map((post) => ({
          type: 'post',
          id: post.id,
          title:
            post.users && post.users.length > 0
              ? `Post by ${post.users[0].username}`
              : 'Post',
          subtitle: new Date(post.created_at).toLocaleString(),
          imageUrl:
            post.users && post.users.length > 0
              ? post.users[0].avatar_url
              : undefined,
          content: post.content,
        }));

        return [...userSearchResults, ...postSearchResults];
      }),
      catchError((error) => {
        console.error('Error in combined search:', error);
        return of([]);
      })
    );
  }
  // Helper function to map database posts to Post model objects
  private mapPostFromSupabase(data: any): Post {
    // Create a properly mapped user object if it exists
    let user = undefined;
    if (data.users) {
      user = {
        id: data.users.id,
        username: data.users.username,
        email: data.users.email,
        fullName: data.users.full_name,
        avatarUrl: data.users.avatar_url,
        bio: data.users.bio,
        theme: data.users.theme || 'light',
        privacySettings: data.users.privacy_settings || {
          postsVisibility: 'public',
          profileVisibility: 'public',
        },
        createdAt: new Date(data.users.created_at),
        updatedAt: new Date(data.users.updated_at),
      };
    }

    // Create the post object with the mapped user
    const post = new Post({
      id: data.id,
      userId: data.user_id,
      content: data.content,
      privacyLevel: data.privacy_level,
      groupId: data.group_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      user: user,
      sharedPostId: data.shared_post_id,
    });

    // Add shared post if it exists, also with a properly mapped user
    if (data.shared_post) {
      let sharedUser = undefined;
      if (data.shared_post.users) {
        sharedUser = {
          id: data.shared_post.users.id,
          username: data.shared_post.users.username,
          email: data.shared_post.users.email,
          fullName: data.shared_post.users.full_name,
          avatarUrl: data.shared_post.users.avatar_url,
          bio: data.shared_post.users.bio,
          theme: data.shared_post.users.theme || 'light',
          privacySettings: data.shared_post.users.privacy_settings || {
            postsVisibility: 'public',
            profileVisibility: 'public',
          },
          createdAt: new Date(data.shared_post.users.created_at),
          updatedAt: new Date(data.shared_post.users.updated_at),
        };
      }

      post.sharedPost = new Post({
        id: data.shared_post.id,
        userId: data.shared_post.user_id,
        content: data.shared_post.content,
        privacyLevel: data.shared_post.privacy_level,
        groupId: data.shared_post.group_id,
        createdAt: new Date(data.shared_post.created_at),
        updatedAt: new Date(data.shared_post.updated_at),
        user: sharedUser,
      });
    }

    return post;
  }
}
