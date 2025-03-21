// src/app/core/services/settings.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private isOpenSubject = new BehaviorSubject<boolean>(false);
  private activeTabSubject = new BehaviorSubject<
    'profile' | 'appearance' | 'account'
  >('profile');

  constructor(private router: Router) {}

  get isOpen$(): Observable<boolean> {
    return this.isOpenSubject.asObservable();
  }

  get activeTab$(): Observable<'profile' | 'appearance' | 'account'> {
    return this.activeTabSubject.asObservable();
  }

  openSettings(tab: 'profile' | 'appearance' | 'account' = 'profile'): void {
    this.activeTabSubject.next(tab);
    this.router.navigate(['/settings']);
  }

  closeSettings(): void {
    this.router.navigate(['/']).then(() => {
      this.isOpenSubject.next(false);
    });
  }

  setActiveTab(tab: 'profile' | 'appearance' | 'account'): void {
    this.activeTabSubject.next(tab);
  }
}
