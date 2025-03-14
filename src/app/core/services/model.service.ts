// src/app/core/services/modal.service.ts
import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Inject } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private renderer: Renderer2;
  private modalOpen = false;
  private modalElement: HTMLElement | null = null;

  // Observable sources to communicate with components
  private modalStateSource = new Subject<boolean>();

  // Observable streams
  modalState$ = this.modalStateSource.asObservable();

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  // Open a modal
  openModal(content: string): void {
    if (this.modalOpen) return; // Prevent multiple modals

    this.modalOpen = true;

    // Create modal container
    this.modalElement = this.renderer.createElement('div');
    this.renderer.addClass(this.modalElement, 'modal-container');

    // Set inner HTML with content
    this.modalElement!.innerHTML = content;

    // Append to body
    this.renderer.appendChild(this.document.body, this.modalElement);

    // Prevent body scrolling
    this.renderer.setStyle(this.document.body, 'overflow', 'hidden');

    // Notify observers
    this.modalStateSource.next(true);
  }

  // Close the modal
  closeModal(): void {
    if (!this.modalOpen || !this.modalElement) return;

    // Remove modal from DOM
    this.renderer.removeChild(this.document.body, this.modalElement);
    this.modalElement = null;

    // Reset state
    this.modalOpen = false;

    // Restore body scrolling
    this.renderer.removeStyle(this.document.body, 'overflow');

    // Notify observers
    this.modalStateSource.next(false);
  }

  // Check if any modal is currently open
  isModalOpen(): boolean {
    return this.modalOpen;
  }
}
