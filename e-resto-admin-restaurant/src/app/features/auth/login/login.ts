import {Component} from "@angular/core";
import {AuthService} from "../../../services/auth/auth-service";
import {Router, RouterModule} from "@angular/router";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import Swal from 'sweetalert2';
import {finalize} from 'rxjs/operators';
import {timeout} from 'rxjs';
import {Footer} from "../../../layouts/footer/footer"; // <--- Important

@Component({
    selector: "app-login",
    standalone: true,
    imports: [FormsModule, CommonModule, RouterModule, ReactiveFormsModule, Footer],
    templateUrl: "./login.html",
    styleUrl: "./login.scss",
})
export class Login {
    showPassword = false;
    email = '';
    password = '';
    isLoading = false;
    error = '';

    constructor(private authService: AuthService, private router: Router) {
    }

    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword;
    }

    login() {
        if (!this.email || !this.password) {
            this.error = "Veuillez remplir tous les champs.";
            return;
        }

        this.isLoading = true;
        this.error = '';

        this.authService.setEmail(this.email);

        this.authService.login(this.email, this.password)
            .pipe(
                timeout(15000),
                finalize(() => {
                    this.isLoading = false;
                })
            )
            .subscribe({
                next: (res) => {
                    localStorage.setItem('temp_token', res.token);
                    if (res.dev_otp) {
                        localStorage.setItem('dev_otp', String(res.dev_otp));
                    } else {
                        localStorage.removeItem('dev_otp');
                    }

                    const Toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000,
                        timerProgressBar: true
                    });

                    Toast.fire({
                        icon: 'success',
                        title: res.dev_otp ? `Code OTP local: ${res.dev_otp}` : 'Valid login details. Check your email inbox.'
                    });

                    this.router.navigate(['/auth/otp']);
                },
                error: (err) => {
                    const message = this.loginErrorMessage(err);
                    Swal.fire({
                        title: 'Erreur',
                        text: message,
                        icon: 'error',
                        confirmButtonColor: '#d33',
                        confirmButtonText: 'Réessayer'
                    });
                    this.error = message;
                }
            });
    }

    private loginErrorMessage(err: any): string {
        if (err?.name === 'TimeoutError') {
            return 'La connexion prend trop de temps. Vérifiez que le backend est démarré puis réessayez.';
        }

        if (err?.status === 0) {
            return "Impossible de joindre le serveur. Vérifiez que l'API Laravel est démarrée.";
        }

        if (err?.status === 401 || err?.status === 404) {
            return 'Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.';
        }

        return err?.error?.message || 'Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.';
    }

}
