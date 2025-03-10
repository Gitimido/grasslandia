// src/app/models/media.model.ts

export interface IMedia {
  id: string;
  postId?: string;
  messageId?: string;
  url: string;
  mediaType: 'image' | 'video';
  orderIndex: number;
  createdAt: Date;
}

export class Media implements IMedia {
  id: string;
  postId?: string;
  messageId?: string;
  url: string;
  mediaType: 'image' | 'video';
  orderIndex: number;
  createdAt: Date;

  constructor(media: IMedia) {
    this.id = media.id;
    this.postId = media.postId;
    this.messageId = media.messageId;
    this.url = media.url;
    this.mediaType = media.mediaType;
    this.orderIndex = media.orderIndex;
    this.createdAt = media.createdAt;
  }

  get isImage(): boolean {
    return this.mediaType === 'image';
  }

  get isVideo(): boolean {
    return this.mediaType === 'video';
  }
}
