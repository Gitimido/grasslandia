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

  // Cookie name to match Supabase's localStorage key
  private readonly COOKIE_NAME = 'sb-auth-token';

  constructor(private router: Router) {
    // Use default Supabase client
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabasePupnon,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'supabase-auth',
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

        // Set custom cookie when user signs up
        if (user) {
          this.setCookie(user.id);
        }

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

    return from(
      this.supabase.auth.signInWithPassword({ email, password })
    ).pipe(
      map((response) => {
        if (response.error) throw response.error;

        const user = response.data.user;
        this.currentUser.next(user);

        // Set custom cookie when user signs in
        if (user) {
          this.setCookie(user.id);
        }

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

    return from(this.supabase.auth.signOut()).pipe(
      tap(() => {
        this.currentUser.next(null);

        // Remove custom cookie on sign out
        this.removeCookie();

        this.router.navigate(['/login']);
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

  // Other auth methods remain the same...

  // ----- COOKIE MANAGEMENT (NEW METHODS) -----

  private setCookie(userId: string): void {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 days expiry

    // Set a custom cookie with user ID
    document.cookie = `${
      this.COOKIE_NAME
    }=${userId}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax; ${
      window.location.protocol === 'https:' ? 'Secure;' : ''
    }`;
  }

  private getCookie(): string | null {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === this.COOKIE_NAME) {
        return value;
      }
    }
    return null;
  }

  private removeCookie(): void {
    document.cookie = `${this.COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }

  // ----- PRIVATE METHODS -----

  private loadUser(): void {
    this.loading.next(true);

    from(this.supabase.auth.getSession())
      .pipe(
        tap(({ data }) => {
          const user = data.session?.user || null;
          this.currentUser.next(user);

          // Sync cookie with user session
          if (user) {
            this.setCookie(user.id);
          } else {
            this.removeCookie();
          }
        }),
        catchError((error) => {
          console.error('Error loading user session:', error.message);
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

      // Update cookie on auth state change
      if (user) {
        this.setCookie(user.id);
      } else {
        this.removeCookie();
      }
    });
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
