import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API_ROOT } from '../../services/api-url';

interface EmployeeVerifyResponse {
  valid: boolean;
  verified_at: string;
  employee: {
    id: string;
    matricule: string;
    first_name: string;
    last_name: string;
    full_name: string;
    fonction: string;
    status: string;
    is_active: boolean;
    email: string | null;
    phone_number: string | null;
    address: string | null;
    education_level: string | null;
    contract_type: string | null;
    shift: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    has_user_account: boolean;
    photo_url: string | null;
    hired_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  restaurant: {
    id: string;
    name: string;
    owner_name: string | null;
    owner_phone: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    logo_url: string | null;
  };
}

@Component({
  selector: 'app-employee-verify',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './employee-verify.html',
  styleUrl: './employee-verify.scss',
})
export class EmployeeVerify implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  loading = signal(true);
  error = signal('');
  data = signal<EmployeeVerifyResponse | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!id || !token) {
      this.loading.set(false);
      this.error.set('QR code incomplet. Impossible de verifier ce badge.');
      return;
    }

    const verificationApiRoot = this.verificationApiRoot();

    this.http.get<EmployeeVerifyResponse>(`${verificationApiRoot}/public/employees/verify/${id}`, {
      params: { token },
    }).subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: (err) => {
        if (err?.status === 0) {
          this.error.set(`Impossible de joindre le serveur de vérification (${verificationApiRoot}). Vérifiez que Laravel est lancé sur l'adresse réseau du PC.`);
        } else {
          this.error.set(err?.error?.message || 'Badge invalide ou employé introuvable.');
        }
        this.loading.set(false);
      },
    });
  }

  initials(): string {
    const employee = this.data()?.employee;
    return `${employee?.first_name?.[0] || ''}${employee?.last_name?.[0] || ''}`.toUpperCase() || 'RS';
  }

  private verificationApiRoot(): string {
    const host = window.location.hostname;
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(host);

    if (isLocalhost) {
      return API_ROOT;
    }

    return `${window.location.protocol}//${host}${window.location.port ? ':' + window.location.port : ''}/api`;
  }
}
