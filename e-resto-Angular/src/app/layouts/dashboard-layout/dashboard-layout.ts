import {ChangeDetectorRef, Component, inject, OnDestroy, OnInit} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {DatePipe, NgClass} from "@angular/common";
import {AuthService} from "../../services/auth/auth-service";
import Swal from "sweetalert2";
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import introJs from 'intro.js';
import {TranslateModule, TranslateService} from "@ngx-translate/core";
import {OrderRealtimeService} from "../../services/realtime/order-realtime-service";
import {ThemeService} from "../../services/theme/theme-service";
import {ReservationService} from "../../services/reservation/reservation-service";
import {Subscription} from "rxjs";

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
    private translate = inject(TranslateService);
    private reservationService = inject(ReservationService);
    private reservationBadgeTimer?: ReturnType<typeof setInterval>;
    private reservationCreatedSubscription?: Subscription;


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
        name: 'Restaura Scan',
        logo: 'assets/logo/e-resto-logo.png',
        city: '',
        owner_phone: '',
        features: {},
        theme: {},
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
    protected pendingReservationsCount = 0;
    protected assistantOpen = false;
    protected assistantInput = '';
    protected assistantMessages: Array<{ from: 'bot' | 'user'; text: string }> = [
        {
            from: 'bot',
            text: 'Bonjour, je suis votre Assistant Restaura Scan. Je peux vous aider avec les commandes, les statistiques, les QR codes, les reservations et votre plan.',
        },
    ];

    ngOnInit(): void {
        this.translate.use(this.currentLang);
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
                name: restaurant.name || 'Restaura Scan',
                logo: restaurant.logo_url || (restaurant.logo ? `http://127.0.0.1:8000/storage/${restaurant.logo}` : 'assets/logo/e-resto-logo.png'),
                city: restaurant.city || '',
                owner_phone: restaurant.owner_phone || '',
                features: {
                    ...this.featuresFromPlan(restaurant.plan),
                    ...(restaurant.features || {}),
                },
                theme: restaurant.theme || restaurant.settings?.theme || restaurant.settings || {},
            };
        }

        this.subscriptionInfo = this.buildSubscriptionInfo(restaurant);
        this.applyRestaurantTheme(restaurant);
        this.loginInfo = {
            connectedAt: this.resolveLoginDate(),
        };
        if (this.canUse('reservations')) {
            this.loadReservationBadge();
            this.reservationCreatedSubscription = this.orderRealtime.reservationCreated$.subscribe(() => {
                this.pendingReservationsCount += 1;
                this.cdref.detectChanges();
            });
            this.reservationBadgeTimer = setInterval(() => this.loadReservationBadge(), 15000);
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
        document.body.classList.remove('restaurant-theme');
        if (this.reservationBadgeTimer) {
            clearInterval(this.reservationBadgeTimer);
        }
        this.reservationCreatedSubscription?.unsubscribe();
    }

    currentLang = localStorage.getItem('app_lang') || 'fr';
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
        this.currentLang = lang === 'en' ? 'en' : 'fr';
        localStorage.setItem('app_lang', this.currentLang);
        this.translate.use(this.currentLang);
    }

    switchLanguage() {
        this.changeLanguage(this.currentLang === 'fr' ? 'en' : 'fr');
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

    private loadReservationBadge(): void {
        this.reservationService.list({ status: 'pending' }).subscribe({
            next: (reservations) => {
                this.pendingReservationsCount = reservations.length;
                this.cdref.detectChanges();
            },
            error: () => {
                this.pendingReservationsCount = 0;
                this.cdref.detectChanges();
            },
        });
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

    private applyRestaurantTheme(restaurant: any): void {
        const defaultTheme = {
            primary: '#F9A11B',
            secondary: '#111318',
            surface: '#FFF7ED',
        };
        const planFeatures = this.featuresFromPlan(restaurant?.plan);
        const features = {
            ...planFeatures,
            ...(restaurant?.features || {}),
        };
        const canCustomize = Boolean(features.customization);
        const theme = restaurant?.theme || restaurant?.settings?.theme || restaurant?.settings || {};
        const primary = this.normalizeColor(canCustomize ? theme.primary_color || theme.primary || theme.accent : null, defaultTheme.primary);
        const secondary = this.normalizeColor(canCustomize ? theme.secondary_color || theme.secondary : null, defaultTheme.secondary);
        const surface = this.normalizeColor(canCustomize ? theme.background_color || theme.background || theme.surface : null, defaultTheme.surface);
        const primaryRgb = this.hexToRgb(primary);

        document.body.classList.add('restaurant-theme');
        document.documentElement.style.setProperty('--dashboard-primary', primary);
        document.documentElement.style.setProperty('--dashboard-primary-rgb', primaryRgb);
        document.documentElement.style.setProperty('--dashboard-secondary', secondary);
        document.documentElement.style.setProperty('--dashboard-surface', surface);
        document.documentElement.style.setProperty('--bs-primary', primary);
        document.documentElement.style.setProperty('--bs-primary-rgb', primaryRgb);
        document.documentElement.style.setProperty('--bs-link-color', primary);
        document.documentElement.style.setProperty('--bs-link-hover-color', secondary);
    }

    private normalizeColor(value: any, fallback: string): string {
        const color = String(value || '').trim();
        if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) {
            return color;
        }

        return fallback;
    }

    private hexToRgb(hex: string): string {
        let clean = hex.replace('#', '').trim();
        if (clean.length === 3) {
            clean = clean.split('').map((char) => char + char).join('');
        }

        const value = Number.parseInt(clean, 16);
        if (Number.isNaN(value)) {
            return '249, 161, 27';
        }

        return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
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
