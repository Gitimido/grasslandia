// src/app/core/services/auth.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  createClient,
  SupabaseClient,
  User,
  Session,
} from '@supabase/supabase-js';
import { Observable, from, throwError, of, forkJoin } from 'rxjs';
import { tap, catchError, finalize, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environment';
import { Store } from '@ngrx/store';
import {
  loginSuccess,
  logout,
  setAuthLoading,
  setAuthError,
} from '../store/Auth/auth.actions';
import {
  selectIsAuthenticated,
  selectUser,
} from '../store/Auth/auth.selectors';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabase: SupabaseClient;

  constructor(private router: Router, private store: Store) {
    // Use default Supabase client with simplified options
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    );

    // Initialize auth state
    this.loadUser();
    this.setupAuthListener();
  }

  // Get authenticated state from store
  get isAuthenticated$(): Observable<boolean> {
    return this.store.select(selectIsAuthenticated);
  }

  // Get user from store
  get user$(): Observable<User | null> {
    return this.store.select(selectUser);
  }

  // For backwards compatibility until all components are updated
  get user(): User | null {
    let currentUser: User | null = null;
    this.user$
      .subscribe((user) => {
        currentUser = user;
      })
      .unsubscribe();
    return currentUser;
  }

  // For backwards compatibility until all components are updated
  isAuthenticated(): boolean {
    let authenticated = false;
    this.isAuthenticated$
      .subscribe((isAuth) => {
        authenticated = isAuth;
      })
      .unsubscribe();
    return authenticated;
  }

  signUp(
    email: string,
    password: string,
    username: string,
    fullName: string
  ): Observable<User | null> {
    this.store.dispatch(setAuthLoading({ isLoading: true }));
    this.store.dispatch(setAuthError({ error: null }));

    const metadata = {
      username: username,
      full_name: fullName,
    };

    return from(
      this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      })
    ).pipe(
      map((response) => {
        if (response.error) throw response.error;

        const user = response.data.user;
        if (user) {
          this.store.dispatch(loginSuccess({ user }));
        }
        return user;
      }),
      catchError((error) => {
        console.error('Error during sign up:', error.message);
        this.store.dispatch(setAuthError({ error: error.message }));
        return of(null);
      }),
      finalize(() => {
        this.store.dispatch(setAuthLoading({ isLoading: false }));
      })
    );
  }

  signIn(email: string, password: string): Observable<User | null> {
    this.store.dispatch(setAuthLoading({ isLoading: true }));
    this.store.dispatch(setAuthError({ error: null }));

    console.log('Signing in with:', email);

    return from(
      this.supabase.auth.signInWithPassword({ email, password })
    ).pipe(
      map((response) => {
        if (response.error) {
          console.error('Sign in error response:', response.error);
          throw response.error;
        }

        const user = response.data.user;
        if (user) {
          this.store.dispatch(loginSuccess({ user }));
        }
        console.log('Sign in successful, user:', user?.id);
        return user;
      }),
      catchError((error) => {
        console.error('Error during sign in:', error.message);
        this.store.dispatch(setAuthError({ error: error.message }));
        return of(null);
      }),
      finalize(() => {
        this.store.dispatch(setAuthLoading({ isLoading: false }));
      })
    );
  }

  signOut(): Observable<void> {
    this.store.dispatch(setAuthLoading({ isLoading: true }));
    console.log('Signing out...');

    return from(this.supabase.auth.signOut()).pipe(
      tap(() => {
        this.store.dispatch(logout());
        console.log('Sign out successful');
        this.router.navigate(['/signin']);
      }),
      map(() => undefined),
      catchError((error) => {
        console.error('Error during sign out:', error.message);
        this.store.dispatch(setAuthError({ error: error.message }));
        return throwError(() => new Error(error.message));
      }),
      finalize(() => {
        this.store.dispatch(setAuthLoading({ isLoading: false }));
      })
    );
  }

  // Used internally by the service constructor
  private loadUser(): void {
    this.store.dispatch(setAuthLoading({ isLoading: true }));
    console.log('Loading user session...');

    from(this.supabase.auth.getSession())
      .pipe(
        tap(({ data, error }) => {
          if (error) {
            console.error('Error loading session:', error.message);
            this.store.dispatch(setAuthError({ error: error.message }));
            return;
          }

          const user = data.session?.user || null;
          console.log(
            'Session loaded:',
            user ? `User ${user.id} found` : 'No active session'
          );

          if (user) {
            this.store.dispatch(loginSuccess({ user }));
          } else {
            this.store.dispatch(logout());
          }
        }),
        catchError((error) => {
          console.error('Error loading user session:', error.message);
          this.store.dispatch(setAuthError({ error: error.message }));
          return of(null);
        }),
        finalize(() => {
          this.store.dispatch(setAuthLoading({ isLoading: false }));
        })
      )
      .subscribe();
  }

  // Used internally by the service constructor
  private setupAuthListener(): void {
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      const user = session?.user || null;

      if (user) {
        this.store.dispatch(loginSuccess({ user }));
      } else {
        this.store.dispatch(logout());
      }
    });
  }

  deleteAccount(): Observable<void> {
    if (!this.user) {
      return throwError(() => new Error('No authenticated user'));
    }

    const userId = this.user.id;
    this.store.dispatch(setAuthLoading({ isLoading: true }));

    // First we'll remove the user's data from Supabase tables
    return this.deleteUserData(userId).pipe(
      switchMap(() => from(this.supabase.auth.admin.deleteUser(userId))),
      map(() => {
        // Dispatch logout action to clear local state
        this.store.dispatch(logout());
        return undefined;
      }),
      catchError((error) => {
        console.error('Error deleting account:', error);
        this.store.dispatch(setAuthError({ error: error.message }));
        return throwError(
          () => new Error('Failed to delete account: ' + error.message)
        );
      }),
      finalize(() => {
        this.store.dispatch(setAuthLoading({ isLoading: false }));
      })
    );
  }

  /**
   * Delete all user data from the database
   * @param userId The ID of the user to delete data for
   */
  private deleteUserData(userId: string): Observable<void> {
    // Create an array of deletion tasks
    const deleteTasks = [
      // Delete user's posts
      from(this.supabase.from('posts').delete().eq('user_id', userId)),

      // Delete user's comments
      from(this.supabase.from('comments').delete().eq('user_id', userId)),

      // Delete user's likes
      from(this.supabase.from('likes').delete().eq('user_id', userId)),

      // Delete user's media
      from(this.supabase.from('media').delete().eq('user_id', userId)),

      // Delete user's notifications (sent to this user)
      from(this.supabase.from('notifications').delete().eq('user_id', userId)),

      // Delete user's notifications (sent by this user)
      from(this.supabase.from('notifications').delete().eq('actor_id', userId)),

      // Delete user's friendships (initiated by this user)
      from(this.supabase.from('friendships').delete().eq('user_id', userId)),

      // Delete user's friendships (received by this user)
      from(this.supabase.from('friendships').delete().eq('friend_id', userId)),

      // Delete user record last (to maintain referential integrity)
      from(this.supabase.from('users').delete().eq('id', userId)),
    ];

    // Execute all deletions in parallel
    return forkJoin(deleteTasks).pipe(
      map(() => undefined),
      catchError((error) => {
        console.error('Error deleting user data:', error);
        return throwError(() => new Error('Failed to delete user data'));
      })
    );
  }
}
