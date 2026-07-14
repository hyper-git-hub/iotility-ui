import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  protected email = '';
  protected password = '';
  protected error = '';

  constructor(private readonly router: Router) {}

  protected login(): void {
    const demoEmail = 'admin@hypernym.io';
    const demoPassword = 'test1234';

    if (this.email === demoEmail && this.password === demoPassword) {
      this.error = '';
      void this.router.navigate(['/home']);
      return;
    }

    this.error = 'Invalid email or password. Try admin@hypernym.io / test1234';
  }
}
