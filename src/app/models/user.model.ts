// src/app/models/user.model.ts

export interface IUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  theme: 'light' | 'dark' | 'blue' | 'purple' | 'green';
  privacySettings: {
    postsVisibility: 'public' | 'friends' | 'only_me';
    profileVisibility: 'public' | 'friends' | 'only_me';
  };
  createdAt: Date;
  updatedAt: Date;
}

export class User implements IUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  theme: 'light' | 'dark' | 'blue' | 'purple' | 'green';
  privacySettings: {
    postsVisibility: 'public' | 'friends' | 'only_me';
    profileVisibility: 'public' | 'friends' | 'only_me';
  };
  createdAt: Date;
  updatedAt: Date;

  constructor(user: IUser) {
    this.id = user.id;
    this.email = user.email;
    this.username = user.username;
    this.fullName = user.fullName;
    this.avatarUrl = user.avatarUrl;
    this.bio = user.bio;
    this.theme = user.theme;
    this.privacySettings = user.privacySettings;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }

  get displayName(): string {
    return this.fullName || this.username;
  }

  get initials(): string {
    return this.fullName
      .split(' ')
      .map((name) => name.charAt(0))
      .join('')
      .toUpperCase();
  }
}
