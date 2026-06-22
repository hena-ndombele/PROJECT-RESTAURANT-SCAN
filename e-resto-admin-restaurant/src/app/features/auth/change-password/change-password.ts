import {Component, inject} from "@angular/core";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {AuthService} from "../../../services/auth/auth-service";
import Swal from "sweetalert2";

@Component({
  selector: "app-change-password",
  imports: [],
  templateUrl: "./change-password.html",
  styleUrl: "./change-password.scss",
  standalone:true
})
export class ChangePassword {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  isLoading = false;
  passwordForm: FormGroup;

  constructor() {
    this.passwordForm = this.fb.group({
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      new_password_confirmation: ['', [Validators.required]]
    }, { validator: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('new_password')?.value === g.get('new_password_confirmation')?.value
        ? null : { mismatch: true };
  }

  onSubmit() {
    if (this.passwordForm.invalid) return;

    this.isLoading = true;
    this.authService.changePassword(this.passwordForm.value).subscribe({
      next: (res) => {
        this.isLoading = false;
        Swal.fire('Succès', res.message, 'success');
        this.passwordForm.reset();
      },
      error: (err) => {
        this.isLoading = false;
        const errorMessage = err.error?.message || 'Une erreur est survenue';
        Swal.fire('Erreur', errorMessage, 'error');
      }
    });
  }
}
