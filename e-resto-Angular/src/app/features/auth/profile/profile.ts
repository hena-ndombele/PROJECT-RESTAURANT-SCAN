import { Component, inject, OnInit } from "@angular/core";
import { AuthService } from "../../../services/auth/auth-service";
import { CommonModule } from "@angular/common";

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
    created_at: '',
    updated_at: ''
  };

  ngOnInit(): void {
    const data = this.authService.getUserData();

    if (data) {
      this.userData = {
        firstName: data.first_name || 'Non renseigné',
        lastName: data.last_name || '',
        email: data.email,
        created_at: data.created_at,
        updated_at: data.updated_at,
        phone: data.phone_number || 'Aucun numéro',
        address: data.address || 'Non précisée',
        avatar: data.avatar ? data.avatar : 'assets/images/default-avatar.png',
        roleLabel: 'Restaurateur'
      };
    }
  }
}