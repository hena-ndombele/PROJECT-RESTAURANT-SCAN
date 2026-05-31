import {ChangeDetectorRef, Component, inject, OnDestroy, OnInit} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {DatePipe, NgClass} from "@angular/common";
import {AuthService} from "../../services/auth/auth-service";
import Swal from "sweetalert2";
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import introJs from 'intro.js';
import {TranslateModule} from "@ngx-translate/core";
import {OrderRealtimeService} from "../../services/realtime/order-realtime-service";
import {ThemeService} from "../../services/theme/theme-service";

@Component({
    selector: 'app-dashboard-layout',
    imports: [RouterLink, RouterLinkActive, RouterOutlet, NgClass, ReactiveFormsModule, TranslateModule, DatePipe],
    styleUrl: "./dashboard-layout.scss",
    templateUrl: './dashboard-layout.html',
    standalone:true
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
    isLoading = false;

    private authService = inject(AuthService);
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private cdref = inject(ChangeDetectorRef);
    protected orderRealtime = inject(OrderRealtimeService);
    protected theme = inject(ThemeService);


    passwordForm: FormGroup;

    constructor() {
        this.passwordForm = this.fb.group({
            current_password: ['', [Validators.required]],
            new_password: ['', [Validators.required, Validators.minLength(6)]],
            new_password_confirmation: ['', [Validators.required]]
        }, {validator: this.passwordMatchValidator});
    }
    userData: any = {
        firstName: '',
        lastName: '',
        fonction: '',
    };
    restaurantData: any = {
        name: 'E-RESTO',
        logo: 'assets/logo/e-resto-logo.png',
        city: '',
        owner_phone: '',
    };

    ngOnInit(): void {
        this.orderRealtime.start();
        const userData = this.authService.getUserData();
        const restaurantSession = localStorage.getItem('restaurant_session');
        const restaurant = restaurantSession ? JSON.parse(restaurantSession) : userData?.restaurant;
        if (userData) {
            this.userData = {
                firstName: userData.first_name || 'Non renseigné',
                lastName: userData.last_name || '',
                fonction: userData.fonction || ''
            };
        }

        if (restaurant) {
            this.restaurantData = {
                name: restaurant.name || 'E-RESTO',
                logo: restaurant.logo_url || (restaurant.logo ? `http://127.0.0.1:8000/storage/${restaurant.logo}` : 'assets/logo/e-resto-logo.png'),
                city: restaurant.city || '',
                owner_phone: restaurant.owner_phone || '',
            };
        }

        this.cdref.detectChanges();

        if (userData && userData.is_first_login) {
            setTimeout(() => {
                this.startFirstLoginGuide();
            }, 500);
        }
    }

    ngOnDestroy(): void {
        this.orderRealtime.stop();
    }

    currentLang = 'fr';
    protected isSidebarCollapsed = false;
    protected isMobileSidebarOpen = false;

    protected toggleSidebar(): void {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }

    protected openMobileSidebar(): void {
        this.isMobileSidebarOpen = true;
    }

    protected closeMobileSidebar(): void {
        this.isMobileSidebarOpen = false;
    }

    changeLanguage(lang: string) {
        console.log("Changement de langue vers :", lang);
    }

    switchLanguage() {
        this.currentLang = this.currentLang === 'fr' ? 'en' : 'fr';
        console.log('Langue changée en :', this.currentLang);
    }


    protected toggleTheme(): void {
        this.theme.toggle();
    }

    protected openNotifications(): void {
        setTimeout(() => this.orderRealtime.markNotificationsRead(), 1200);
    }

    passwordMatchValidator(g: FormGroup) {
        return g.get('new_password')?.value === g.get('new_password_confirmation')?.value
            ? null : {mismatch: true};
    }

    onSubmit() {
        if (this.passwordForm.invalid) return;

        this.isLoading = true;
        this.authService.changePassword(this.passwordForm.value).subscribe({
            next: (res) => {
                console.log("res******", res);
                this.isLoading = false

                Swal.fire({
                    title: 'Success !',
                   text: res.message,
                    icon: 'success',
                    confirmButtonText: 'Close',
                    timerProgressBar: true,
                    timer: 3000,
                    confirmButtonColor: '#28a745'
                }).then(() => {
                    window.location.reload();
                });
            },
            error: (err) => {
                console.error("err******", err);
                this.isLoading = false;
                const errorMessage = err.error?.message || 'Une erreur est survenue';

                Swal.fire({
                    title: 'Error',
                    text: errorMessage || '\n' +
                        'Error during creation.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Try again'
                });
            }
        });
    }

    logout() {
        this.isLoading = true;

        this.authService.logout().subscribe({
            next: (res) => {
                console.log("res**************", res);
                const modalElement = document.getElementById('logoutModal');
                if (modalElement) {
                    const modalInstance = (window as any).bootstrap?.Modal.getInstance(modalElement);
                    modalInstance?.hide();
                }
                this.isLoading = false;
                window.location.reload();
                this.router.navigate(['/auth/login']);
            },
            error: (err) => {
                console.error('Erreur logout', err);
                Swal.fire({
                    title: 'Error',
                    text: err.error?.message || '\n' +
                        'Error during disconnection.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Try again'
                });
                localStorage.clear();
                this.isLoading = false;
                this.router.navigate(['/auth/login']);
            }
        });
    }


    startFirstLoginGuide() {
        const guideAlreadyShown = localStorage.getItem('guide_shown');
        if (guideAlreadyShown) return;

        const intro = introJs();

        intro.setOptions({
            steps: [
                {
                    element: '#profileIcon',
                    intro: "Bienvenue Hena ! Cliquez sur votre profil pour accéder aux paramètres.",
                    position: 'bottom'
                },
                {
                    element: '#userDropdown',
                    intro: "Pour votre sécurité, veuillez changer votre mot de passe temporaire ici.",
                    position: 'left'
                }
            ],
            doneLabel: 'Compris !',
            nextLabel: 'Suivant',
            prevLabel: 'Précédent',
            exitOnOverlayClick: false,
            showStepNumbers: false
        });

        intro.onbeforechange((targetElement: HTMLElement) => {
            if (targetElement.id === 'userDropdown') {
                const profileBtn = document.getElementById('profileIcon');
                const dropdownMenu = document.querySelector('.dropdown-menu');

                if (profileBtn && !dropdownMenu?.classList.contains('show')) {
                    profileBtn.click();
                }
            }

            return true;
        });

        intro.oncomplete(() => {
            localStorage.setItem('guide_shown', 'true');
        });

        intro.onexit(() => {
            localStorage.setItem('guide_shown', 'true');
        });

        intro.start();
    }

}
