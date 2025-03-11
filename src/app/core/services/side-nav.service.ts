// src/app/core/services/side-nav.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SideNavService {
  private _sidebarCollapsed = new BehaviorSubject<boolean>(false);

  get sidebarState(): Observable<boolean> {
    return this._sidebarCollapsed.asObservable();
  }

  toggleSidebar(): void {
    this._sidebarCollapsed.next(!this._sidebarCollapsed.value);
  }

  setSidebarState(isCollapsed: boolean): void {
    this._sidebarCollapsed.next(isCollapsed);
  }

  constructor() {}
}
