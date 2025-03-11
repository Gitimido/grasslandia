import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  createClient,
  SupabaseClient,
  User,
  Session,
} from '@supabase/supabase-js';
import { BehaviorSubject, Observable, from, throwError, of } from 'rxjs';
import { tap, catchError, finalize, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabase: SupabaseClient;
  private currentUser = new BehaviorSubject<User | null>(null);
  private loading = new BehaviorSubject<boolean>(false);

  constructor(private router: Router) {
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

  get user(): User | null {
    return this.currentUser.value;
  }

  get user$(): Observable<User | null> {
    return this.currentUser.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this.loading.asObservable();
  }

  isAuthenticated(): boolean {
    return !!this.currentUser.value;
  }

  // ----- AUTHENTICATION METHODS (PUBLIC API) -----

  signUp(email: string, password: string): Observable<User | null> {
    this.loading.next(true);

    return from(this.supabase.auth.signUp({ email, password })).pipe(
      map((response) => {
        if (response.error) throw response.error;

        const user = response.data.user;
        this.currentUser.next(user);
        return user;
      }),
      catchError((error) => {
        console.error('Error during sign up:', error.message);
        return of(null);
      }),
      finalize(() => {
        this.loading.next(false);
      })
    );
  }

  signIn(email: string, password: string): Observable<User | null> {
    this.loading.next(true);
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
        this.currentUser.next(user);
        console.log('Sign in successful, user:', user?.id);
        return user;
      }),
      catchError((error) => {
        console.error('Error during sign in:', error.message);
        return of(null);
      }),
      finalize(() => {
        this.loading.next(false);
      })
    );
  }

  signOut(): Observable<void> {
    this.loading.next(true);
    console.log('Signing out...');

    return from(this.supabase.auth.signOut()).pipe(
      tap(() => {
        this.currentUser.next(null);
        console.log('Sign out successful');
        this.router.navigate(['/signin']);
      }),
      map(() => undefined),
      catchError((error) => {
        console.error('Error during sign out:', error.message);
        return throwError(() => new Error(error.message));
      }),
      finalize(() => {
        this.loading.next(false);
      })
    );
  }

  // ----- PRIVATE METHODS -----

  private loadUser(): void {
    this.loading.next(true);
    console.log('Loading user session...');

    from(this.supabase.auth.getSession())
      .pipe(
        tap(({ data, error }) => {
          if (error) {
            console.error('Error loading session:', error.message);
            this.currentUser.next(null);
            return;
          }

          const user = data.session?.user || null;
          console.log(
            'Session loaded:',
            user ? `User ${user.id} found` : 'No active session'
          );
          this.currentUser.next(user);
        }),
        catchError((error) => {
          console.error('Error loading user session:', error.message);
          this.currentUser.next(null);
          return of(null);
        }),
        finalize(() => {
          this.loading.next(false);
        })
      )
      .subscribe();
  }

  private setupAuthListener(): void {
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      const user = session?.user || null;
      this.currentUser.next(user);
    });
  }

  // Manual refresh method for debugging
  refreshSession(): Observable<boolean> {
    console.log('Manually refreshing session...');
    return from(this.supabase.auth.getSession()).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error refreshing session:', error);
          this.currentUser.next(null);
          return false;
        }

        const user = data.session?.user || null;
        console.log(
          'Session refresh result:',
          user ? `User ${user.id} found` : 'No active session'
        );
        this.currentUser.next(user);
        return !!user;
      }),
      catchError((error) => {
        console.error('Session refresh error:', error);
        return of(false);
      })
    );
  }

  /* 
  // Sign in with Google - Commented out for future use
  signInWithGoogle(): Observable<any> {
    return from(this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback'
      }
    })).pipe(
      catchError(error => {
        console.error('Google sign-in error:', error.message);
        return throwError(() => new Error(error.message));
      })
    );
  }
  */
}
