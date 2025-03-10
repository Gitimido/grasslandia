import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
})
export class SignInComponent {
  signInForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.signInForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onSubmit(): void {
    if (this.signInForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      const { email, password } = this.signInForm.value;

      this.authService.signIn(email, password).subscribe({
        next: (user) => {
          if (user) {
            this.router.navigate(['/']);
          } else {
            this.errorMessage = 'Invalid email or password';
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage =
            error.message || 'An error occurred during sign in';
          this.isLoading = false;
        },
      });
    } else {
      this.signInForm.markAllAsTouched();
    }
  }
}
