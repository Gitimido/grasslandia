import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IMedia, Media } from '../../models';

@Component({
  selector: 'app-media-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-display.component.html',
  styleUrl: './media-display.component.scss',
})
export class MediaDisplayComponent implements OnChanges {
  // Accept IMedia[] but convert to Media[] internally for access to getters
  private _media: Media[] = [];

  @Input() set media(value: IMedia[] | undefined) {
    console.log('Media-display received media:', value);
    if (value && value.length > 0) {
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

  get hasMedia(): boolean {
    return this._media && this._media.length > 0;
  }

  get hasMultipleMedia(): boolean {
    return this.media.length > 1;
  }

  get currentMedia(): Media | null {
    return this.media[this.currentIndex] || null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['media']) {
      console.log('Media-display media changed:', this._media);
      // Reset current index when media changes
      this.currentIndex = 0;
    }
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

  ngAfterViewInit() {
    // Log media type information to help debug
    if (this.hasMedia && this.currentMedia) {
      console.log('Media type:', this.currentMedia.mediaType);
      console.log('Is video:', this.currentMedia.isVideo);
      console.log('Media URL:', this.currentMedia.url);
    }
  }
}
