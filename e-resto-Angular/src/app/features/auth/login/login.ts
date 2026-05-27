import {Component} from "@angular/core";
import {AuthService} from "../../../services/auth/auth-service";
import {Router, RouterModule} from "@angular/router";
import {FormsModule, NgForm, ReactiveFormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import Swal from 'sweetalert2';
import {finalize} from 'rxjs/operators';
import {AccountRequestInput} from "../../../models/users/AccountRequestInput";
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
    isSubmittingContact = false;

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
                finalize(() => {
                    this.isLoading = false;
                })
            )
            .subscribe({
                next: (res) => {
                    localStorage.setItem('temp_token', res.token);

                    const Toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000,
                        timerProgressBar: true
                    });

                    Toast.fire({
                        icon: 'success',
                        title: 'Valid login details. Check your email inbox.'
                    });

                    this.router.navigate(['/auth/otp']);
                },
                error: (err) => {
                    this.isLoading = false;
                    Swal.fire({
                        title: 'Error',
                        text: err.error?.message || 'Invalid email or password.',
                        icon: 'error',
                        confirmButtonColor: '#d33',
                        confirmButtonText: 'Try again'
                    });
                    this.isLoading = false;
                    this.error = err.error?.message || "Identifiants invalides.";
                }
            });
    }

    onContactSubmit(form: NgForm) {
        if (form.invalid) {
            return;
        }
        this.isSubmittingContact = true;
        const payload: AccountRequestInput = {
            username: form.value.username,
            phone: form.value.phone,
            message: form.value.message
        };
        console.log(payload);

        this.authService.sendAccountRequest(payload).subscribe({
            next: (res) => {
                this.isSubmittingContact = false;
                console.log("res", res);
                Swal.fire({
                    title: 'Succès !',
                    text: 'Your request has been successfully sent.',
                    icon: 'success',
                    confirmButtonColor: '#F9A11B'
                });
                window.location.reload();
                form.resetForm();
            },
            error: (err) => {
                console.log(err);
                this.isSubmittingContact = false;

                Swal.fire({
                    title: 'Error',
                    text: err.error?.message || 'Impossible d\'envoyer la demande.',
                    icon: 'error',
                    confirmButtonColor: '#d33'
                });
            }
        });
    }
}