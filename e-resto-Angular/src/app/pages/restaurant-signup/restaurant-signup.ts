import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-restaurant-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restaurant-signup.html',
  styleUrl: './restaurant-signup.scss',
})
export class RestaurantSignup {
  account = {
    restaurant_name: '',
    owner_name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
  };
  message = '';

  constructor(private router: Router, private route: ActivatedRoute) {}

  createAccount(): void {
    if (!this.account.restaurant_name || !this.account.owner_name || !this.account.email || !this.account.password) {
      this.message = 'Completez les champs obligatoires pour creer le compte.';
      return;
    }

    if (this.account.password !== this.account.password_confirmation) {
      this.message = 'Les mots de passe ne correspondent pas.';
      return;
    }

    localStorage.setItem('restaurant_account', JSON.stringify(this.account));
    this.router.navigate(['/restaurant/checkout'], { queryParams: this.route.snapshot.queryParams });
  }
}
