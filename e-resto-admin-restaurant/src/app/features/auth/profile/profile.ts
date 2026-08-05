import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AuthService } from "../../../services/auth/auth-service";
import { STORAGE_ROOT } from "../../../services/api-url";

@Component({
  selector: "app-profile",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./profile.html",
  styleUrl: "./profile.scss",
})
export class Profile implements OnInit {
  private authService = inject(AuthService);

  userData: any = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    avatar: 'assets/images/default-avatar.png',
    roleLabel: 'Agent',
    restaurantName: '',
    restaurantCity: '',
    restaurantPhone: '',
    restaurantCurrency: '',
    restaurantStatus: '',
    restaurantPlan: '',
    restaurantLogo: 'assets/logo/e-resto-logo.png',
    created_at: '',
    updated_at: ''
  };

  ngOnInit(): void {
    const data = this.authService.getUserData();
    const restaurant = JSON.parse(localStorage.getItem('restaurant_session') || 'null') || data?.restaurant || {};

    if (data) {
      this.userData = {
        firstName: data.first_name || 'Non renseigne',
        lastName: data.last_name || '',
        email: data.email,
        created_at: data.created_at,
        updated_at: data.updated_at,
        phone: data.phone_number || 'Aucun numéro',
        address: data.address || 'Non precisee',
        avatar: data.avatar ? data.avatar : 'assets/images/default-avatar.png',
        roleLabel: 'Restaurateur',
        restaurantName: restaurant.name || 'Non renseigne',
        restaurantCity: restaurant.city || 'Non renseignee',
        restaurantPhone: restaurant.owner_phone || 'Aucun numéro',
        restaurantCurrency: restaurant.currency || 'CDF',
        restaurantStatus: restaurant.status || 'Non renseigne',
        restaurantPlan: restaurant.plan?.name || 'Non renseigne',
        restaurantLogo: this.restaurantLogo(restaurant)
      };
    }
  }

  private restaurantLogo(restaurant: any): string {
    return restaurant?.logo_data_url
      || restaurant?.logo_url
      || (restaurant?.logo ? `${STORAGE_ROOT}/${restaurant.logo}` : 'assets/logo/e-resto-logo.png');
  }
}
