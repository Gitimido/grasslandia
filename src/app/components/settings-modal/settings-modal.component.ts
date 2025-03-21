// src/app/components/settings-modal/settings-modal.component.ts
import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../models';
import { ProfileSettingsComponent } from './profile-settings/profile-settings.component';
import { AppearanceSettingsComponent } from './appearance-settings/appearance-settings.component';
import { AccountSettingsComponent } from './account-settings/account-settings.component';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [
    CommonModule,
    ProfileSettingsComponent,
    AppearanceSettingsComponent,
    AccountSettingsComponent,
  ],
  templateUrl: './settings-modal.component.html',
  styleUrls: ['./settings-modal.component.scss'],
})
export class SettingsModalComponent {
  @Input() user: User | null = null;
  @Output() close = new EventEmitter<void>();

  activeTab: 'profile' | 'appearance' | 'account' = 'profile';

  constructor() {}

  setActiveTab(tab: 'profile' | 'appearance' | 'account'): void {
    this.activeTab = tab;
  }

  closeModal(): void {
    this.close.emit();
  }
}
