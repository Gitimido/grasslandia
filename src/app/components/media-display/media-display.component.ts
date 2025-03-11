import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IMedia, Media } from '../../models';

@Component({
  selector: 'app-media-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-display.component.html',
  styleUrl: './media-display.component.scss',
})
export class MediaDisplayComponent {
  // Accept IMedia[] but convert to Media[] internally for access to getters
  private _media: Media[] = [];

  @Input() set media(value: IMedia[] | undefined) {
    if (value) {
      this._media = value.map((item) =>
        item instanceof Media ? item : new Media(item)
      );
    } else {
      this._media = [];
    }
  }

  get media(): Media[] {
    return this._media;
  }

  currentIndex = 0;

  get hasMultipleMedia(): boolean {
    return this.media.length > 1;
  }

  get currentMedia(): Media | null {
    return this.media[this.currentIndex] || null;
  }

  nextMedia(): void {
    if (this.currentIndex < this.media.length - 1) {
      this.currentIndex++;
    }
  }

  prevMedia(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
  }

  goToMedia(index: number): void {
    if (index >= 0 && index < this.media.length) {
      this.currentIndex = index;
    }
  }
}
