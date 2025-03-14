// src/app/pages/post-detail/post-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PostService } from '../../core/services/post.service';
import { SideNavComponent } from '../../components/side-nav/side-nav.component';
import { PostCardComponent } from '../../components/post-card/post-card.component';
import { CommentsSectionComponent } from '../../components/comments-section/comments-section.component';
import { SideNavService } from '../../core/services/side-nav.service';
import { Post } from '../../models';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SideNavComponent,
    PostCardComponent,
    CommentsSectionComponent,
  ],
  templateUrl: './post-detail.component.html',
  styleUrls: ['./post-detail.component.scss'],
})
export class PostDetailComponent implements OnInit {
  post: Post | null = null;
  isLoading = true;
  error: string | null = null;
  isSidebarCollapsed = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    private sideNavService: SideNavService
  ) {}

  ngOnInit(): void {
    // Track sidebar collapse state
    this.sideNavService.sidebarState.subscribe((state) => {
      this.isSidebarCollapsed = state;
    });

    // Get post ID from route parameters
    this.route.paramMap.subscribe((params) => {
      const postId = params.get('id');
      if (!postId) {
        this.router.navigate(['/']);
        return;
      }

      this.loadPost(postId);
    });
  }

  loadPost(postId: string): void {
    this.isLoading = true;
    this.error = null;

    this.postService.getPost(postId).subscribe({
      next: (post) => {
        this.post = post;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading post:', err);
        this.error =
          'Unable to load the post. It may have been deleted or is not available.';
        this.isLoading = false;
      },
    });
  }

  handlePostDeleted(): void {
    // Navigate back to home after post is deleted
    this.router.navigate(['/']);
  }
}
