import {ChangeDetectorRef, Component, inject, OnDestroy, OnInit} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {DatePipe, NgClass} from "@angular/common";
import {AuthService} from "../../services/auth/auth-service";
import Swal from "sweetalert2";
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import introJs from 'intro.js';
import {TranslateModule} from "@ngx-translate/core";
import {OrderRealtimeService} from "../../services/realtime/order-realtime-service";
import {ThemeService} from "../../services/theme/theme-service";

@Component({
    selector: 'app-dashboard-layout',
    imports: [RouterLink, RouterLinkActive, RouterOutlet, NgClass, ReactiveFormsModule, FormsModule, TranslateModule, DatePipe],
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
        features: {},
    };
    protected subscriptionInfo = {
        label: 'Abonnement non renseigne',
        shortLabel: 'Abonnement',
        detail: 'Statut indisponible',
        tone: 'neutral',
        expiresAt: null as Date | null,
        daysRemaining: null as number | null,
    };
    protected loginInfo = {
        connectedAt: new Date(),
    };
    protected assistantOpen = false;
    protected assistantInput = '';
    protected assistantMessages: Array<{ from: 'bot' | 'user'; text: string }> = [
        {
            from: 'bot',
            text: 'Bonjour, je suis votre Assistant E-RESTO. Je peux vous aider avec les commandes, les statistiques, les QR codes, les reservations et votre plan.',
        },
    ];

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
                features: {
                    ...this.featuresFromPlan(restaurant.plan),
                    ...(restaurant.features || {}),
                },
            };
        }

        this.subscriptionInfo = this.buildSubscriptionInfo(restaurant);
        this.loginInfo = {
            connectedAt: this.resolveLoginDate(),
        };

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

    protected canUse(feature: string): boolean {
        return Boolean(this.restaurantData.features?.[feature]);
    }

    private featuresFromPlan(plan: any): Record<string, boolean> {
        const slug = String(plan?.slug || plan?.name || '').toLowerCase();
        const isBusiness = slug.includes('business');
        const isPro = isBusiness || slug.includes('pro');

        return {
            reservations: isPro,
            feedback: isPro,
            analytics: isPro,
            customization: isPro,
            mobile_money: isPro,
            roles: isBusiness,
            multi_restaurant: isBusiness,
            chatbot: isPro,
        };
    }

    protected toggleAssistant(): void {
        this.assistantOpen = !this.assistantOpen;
    }

    protected askAssistant(question?: string): void {
        const text = (question || this.assistantInput || '').trim();
        if (!text) return;

        this.assistantMessages = [
            ...this.assistantMessages,
            { from: 'user', text },
            { from: 'bot', text: this.dashboardAssistantReply(text) },
        ];
        this.assistantInput = '';
    }

    private dashboardAssistantReply(question: string): string {
        const normalized = question.toLowerCase();
        const restaurantName = this.restaurantData.name || 'votre restaurant';
        const planName = this.subscriptionInfo.detail.replace('Paiement confirme - ', '').replace('Essai gratuit - ', '') || 'votre plan';

        if (normalized.includes('commande')) {
            return `Surveillez vos commandes depuis le menu Orders. Les nouvelles commandes arrivent en temps reel avec son, badge et notification. Pour accelerer le service, traitez-les dans l'ordre pending -> preparing -> ready -> delivered.`;
        }

        if (normalized.includes('stat') || normalized.includes('revenu') || normalized.includes('vente')) {
            return this.canUse('analytics')
                ? `Votre plan permet les statistiques. Regardez le dashboard pour suivre les revenus par devise, les commandes du jour et les plats les plus commandes.`
                : `Les statistiques detaillees sont reservees aux plans Pro et Business. Passez sur Pro pour voir les analyses avancees.`;
        }

        if (normalized.includes('qr') || normalized.includes('table')) {
            return `Pour ${restaurantName}, creez vos tables puis imprimez leurs QR codes. Chaque QR ouvre le menu client et rattache la commande a la bonne table.`;
        }

        if (normalized.includes('reservation')) {
            return this.canUse('reservations')
                ? `Les reservations sont actives sur ${planName}. Vos clients peuvent reserver depuis le menu public et vous confirmez ensuite dans Reservations.`
                : `Les reservations sont reservees aux plans Pro et Business.`;
        }

        if (normalized.includes('plan') || normalized.includes('abonnement') || normalized.includes('jour')) {
            return `${this.subscriptionInfo.label}. ${this.subscriptionInfo.expiresAt ? 'Fin prevue le ' + this.subscriptionInfo.expiresAt.toLocaleString() + '.' : this.subscriptionInfo.detail + '.'}`;
        }

        if (normalized.includes('plat') || normalized.includes('menu')) {
            return `Gardez votre menu court, clair et visuel. Mettez les plats populaires en avant, ajoutez des photos nettes et marquez rapidement les plats epuises.`;
        }

        if (normalized.includes('fidel')) {
            return `Le module fidelite peut recompenser les clients apres plusieurs commandes : points, tampons ou coupons. C'est ideal pour faire revenir les clients reguliers.`;
        }

        return `Je peux vous guider sur ${restaurantName} : commandes, QR codes, menu, reservations, statistiques, abonnement et idees de fidelisation. Essayez par exemple "Quels conseils pour vendre plus ?"`;
    }

    private buildSubscriptionInfo(restaurant: any): {
        label: string;
        shortLabel: string;
        detail: string;
        tone: string;
        expiresAt: Date | null;
        daysRemaining: number | null;
    } {
        const status = String(restaurant?.status || restaurant?.subscription?.status || '').toLowerCase();
        const planName = restaurant?.plan?.name || 'Plan';
        const isTrial = status === 'trial';
        const expiresAt = this.parseDate(
            isTrial
                ? restaurant?.trial_ends_at
                : restaurant?.subscription_ends_at || restaurant?.subscription?.ends_at || restaurant?.subscription?.current_period_end
        ) || this.parseDate(restaurant?.trial_ends_at);
        const daysRemaining = expiresAt ? this.daysUntil(expiresAt) : null;
        const hasExpired = daysRemaining !== null && daysRemaining <= 0;

        if (hasExpired || status === 'past_due' || status === 'expired') {
            return {
                label: 'Abonnement expire',
                shortLabel: 'Expire',
                detail: expiresAt ? 'Date limite atteinte' : 'Paiement requis',
                tone: 'danger',
                expiresAt,
                daysRemaining: 0,
            };
        }

        if (status === 'pending_payment') {
            return {
                label: 'Paiement en attente',
                shortLabel: 'En attente',
                detail: 'Votre espace sera active apres confirmation',
                tone: 'warning',
                expiresAt,
                daysRemaining,
            };
        }

        if (status === 'suspended' || status === 'cancelled') {
            return {
                label: status === 'cancelled' ? 'Abonnement annule' : 'Abonnement suspendu',
                shortLabel: status === 'cancelled' ? 'Annule' : 'Suspendu',
                detail: 'Contactez le support pour reactiver le compte',
                tone: 'danger',
                expiresAt,
                daysRemaining,
            };
        }

        if (isTrial) {
            return {
                label: `${daysRemaining ?? 0} jour${daysRemaining === 1 ? '' : 's'} d'essai restant${daysRemaining === 1 ? '' : 's'}`,
                shortLabel: `${daysRemaining ?? 0}j essai`,
                detail: `Essai gratuit - ${planName}`,
                tone: daysRemaining !== null && daysRemaining <= 3 ? 'warning' : 'trial',
                expiresAt,
                daysRemaining,
            };
        }

        if (status === 'active') {
            return {
                label: daysRemaining === null
                    ? 'Abonnement actif'
                    : `${daysRemaining} jour${daysRemaining === 1 ? '' : 's'} d'abonnement restant${daysRemaining === 1 ? '' : 's'}`,
                shortLabel: daysRemaining === null ? 'Actif' : `${daysRemaining}j actif`,
                detail: `Paiement confirme - ${planName}`,
                tone: 'success',
                expiresAt,
                daysRemaining,
            };
        }

        return {
            label: daysRemaining === null
                ? 'Aucun abonnement actif'
                : `${daysRemaining} jour${daysRemaining === 1 ? '' : 's'} restant${daysRemaining === 1 ? '' : 's'}`,
            shortLabel: daysRemaining === null ? 'Non paye' : `${daysRemaining}j`,
            detail: 'Abonnement non paye ou statut inconnu',
            tone: daysRemaining === null ? 'warning' : 'neutral',
            expiresAt,
            daysRemaining,
        };
    }

    private resolveLoginDate(): Date {
        const storedLoginAt = localStorage.getItem('restaurant_login_at');
        const parsed = this.parseDate(storedLoginAt);
        if (parsed) {
            return parsed;
        }

        const now = new Date();
        localStorage.setItem('restaurant_login_at', now.toISOString());
        return now;
    }

    private parseDate(value: any): Date | null {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    private daysUntil(date: Date): number {
        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        return Math.max(0, Math.ceil((date.getTime() - Date.now()) / millisecondsPerDay));
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
                this.router.navigate(['/restaurant/login']);
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
                this.router.navigate(['/restaurant/login']);
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
