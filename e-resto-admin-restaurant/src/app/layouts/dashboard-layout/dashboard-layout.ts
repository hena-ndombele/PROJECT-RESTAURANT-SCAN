import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DatePipe, DecimalPipe, NgClass } from "@angular/common";
import { AuthService } from "../../services/auth/auth-service";
import Swal from "sweetalert2";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { OrderRealtimeService } from "../../services/realtime/order-realtime-service";
import { ThemeService } from "../../services/theme/theme-service";
import { ReservationService } from "../../services/reservation/reservation-service";
import { Subscription } from "rxjs";
import { AppPermissionService } from "../../services/auth/permission-service";
import { STORAGE_ROOT } from "../../services/api-url";
import { Order } from "../../models/orders/OrderDto";

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    prompt(): Promise<void>;
}

@Component({
    selector: 'app-dashboard-layout',
    imports: [RouterLink, RouterLinkActive, RouterOutlet, NgClass, ReactiveFormsModule, FormsModule, TranslateModule, DatePipe, DecimalPipe],
    styleUrl: "./dashboard-layout.scss",
    templateUrl: './dashboard-layout.html',
    standalone: true
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
    private permissions = inject(AppPermissionService);
    private reservationBadgeTimer?: ReturnType<typeof setInterval>;
    private reservationCreatedSubscription?: Subscription;
    private orderChangedSubscription?: Subscription;
    private deferredInstallPrompt?: BeforeInstallPromptEvent;
    private installDismissedForCurrentView = false;
    private installPromptCheckTimer?: ReturnType<typeof setTimeout>;
    private readonly installedStorageKey = 'restaurant_scan_pwa_installed';

    passwordForm: FormGroup;

    constructor() {
        this.passwordForm = this.fb.group({
            current_password: ['', [Validators.required]],
            new_password: ['', [Validators.required, Validators.minLength(6)]],
            new_password_confirmation: ['', [Validators.required]]
        }, { validator: this.passwordMatchValidator });
    }

    userData: any = {
        firstName: '',
        lastName: '',
        fonction: '',
    };
    restaurantData: any = {
        name: 'Restaurant Scan',
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
    protected installPromptOpen = false;
    protected installAvailable = false;
    protected iosInstallHelp = false;
    protected manualInstallHelp = false;
    protected incomingOrder: Order | null = null;
    protected assistantMessages: Array<{ from: 'bot' | 'user'; text: string }> = [
        {
            from: 'bot',
            text: 'Bonjour, je suis votre Assistant Restaurant Scan. Je peux vous aider avec les commandes, les statistiques, les QR codes, les réservations et votre plan.',
        },
    ];

    private handleRestaurantSettingsUpdated = (event: Event): void => {
        const restaurant = (event as CustomEvent).detail;
        if (!restaurant) return;

        this.syncRestaurantData(restaurant);
        this.subscriptionInfo = this.buildSubscriptionInfo(restaurant);
        this.applyRestaurantTheme(restaurant);
        this.cdref.detectChanges();
    };

    ngOnInit(): void {
        this.prepareInstallPrompt();
        window.addEventListener('restaurant-settings-updated', this.handleRestaurantSettingsUpdated);
        this.translate.use(this.currentLang);
        this.orderRealtime.start();
        this.orderChangedSubscription = this.orderRealtime.orderChanged$.subscribe((order) => {
            if (this.router.url.startsWith('/orders/list')) {
                return;
            }

            this.incomingOrder = order;
            this.cdref.detectChanges();
        });
        const userData = this.authService.getUserData();
        const restaurantSession = localStorage.getItem('restaurant_session');
        const restaurant = restaurantSession ? JSON.parse(restaurantSession) : userData?.restaurant;
        if (userData) {
            this.userData = {
                firstName: userData.first_name || 'Non renseigne',
                lastName: userData.last_name || '',
                fonction: userData.fonction || ''
            };
        }

        this.syncRestaurantData(restaurant);

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
                this.openFirstLoginPasswordModal();
            }, 500);
        }

        this.scheduleInstallPromptCheck(1200);
    }

    ngOnDestroy(): void {
        this.orderRealtime.stop();
        this.cleanupBlockingOverlays();
        document.body.classList.remove('restaurant-theme');
        this.setBrowserThemeColor('#111318');
        window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', this.handleAppInstalled);
        window.removeEventListener('focus', this.handleInstallFocusCheck);
        window.removeEventListener('restaurant-settings-updated', this.handleRestaurantSettingsUpdated);
        document.removeEventListener('visibilitychange', this.handleInstallVisibilityCheck);
        if (this.installPromptCheckTimer) {
            clearTimeout(this.installPromptCheckTimer);
        }
        if (this.reservationBadgeTimer) {
            clearInterval(this.reservationBadgeTimer);
        }
        this.reservationCreatedSubscription?.unsubscribe();
        this.orderChangedSubscription?.unsubscribe();
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

    protected dismissIncomingOrder(): void {
        this.incomingOrder = null;
    }

    protected openIncomingOrder(): void {
        this.incomingOrder = null;
        this.router.navigate(['/orders/list']);
    }

    protected orderItemsCount(order: Order): number {
        return (order.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
    }

    protected orderTypeLabel(order: Order): string {
        if (order.order_type === 'remote') return 'En ligne';
        return order.order_type === 'takeaway' ? 'A emporter' : 'Sur place';
    }

    protected canUse(feature: string): boolean {
        return Boolean(this.restaurantData.features?.[feature]);
    }

    protected canAccess(permission: string): boolean {
        return this.permissions.has(permission);
    }

    private syncRestaurantData(restaurant: any): void {
        if (!restaurant) return;

        this.restaurantData = {
            name: restaurant.name || 'Restaurant Scan',
            logo: restaurant.logo_url || (restaurant.logo ? `${STORAGE_ROOT}/${restaurant.logo}` : 'assets/logo/e-resto-logo.png'),
            city: restaurant.city || '',
            owner_phone: restaurant.owner_phone || '',
            features: {
                ...this.featuresFromPlan(restaurant.plan),
                ...(restaurant.features || {}),
            },
            theme: restaurant.theme || restaurant.settings?.theme || restaurant.settings || {},
        };
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
            analytics: true,
            customization: isPro,
            mobile_money: isPro,
            roles: true,
            multi_restaurant: isBusiness,
            chatbot: isBusiness,
        };
    }

    private applyRestaurantTheme(restaurant: any): void {
        const defaultTheme = {
            primary: '#ff7a1a',
            secondary: '#d71920',
            surface: '#fff7ef',
        };
        const planFeatures = this.featuresFromPlan(restaurant?.plan);
        const features = {
            ...planFeatures,
            ...(restaurant?.features || {}),
        };
        const canCustomize = Boolean(features.customization);
        const theme = restaurant?.theme || restaurant?.settings?.theme || restaurant?.settings || {};
        const hasCustomTheme = canCustomize && this.hasCustomizedTheme(theme);
        const primary = this.normalizeColor(hasCustomTheme ? theme.primary_color || theme.primary || theme.accent : null, defaultTheme.primary);
        const secondary = this.normalizeColor(hasCustomTheme ? theme.secondary_color || theme.secondary : null, defaultTheme.secondary);
        const surface = this.normalizeColor(hasCustomTheme ? theme.background_color || theme.background || theme.surface : null, defaultTheme.surface);
        const primaryRgb = this.hexToRgb(primary);
        const buttonBackground = hasCustomTheme
            ? primary
            : 'linear-gradient(135deg, #ff7a1a, #d71920)';

        document.body.classList.add('restaurant-theme');
        document.documentElement.style.setProperty('--dashboard-primary', primary);
        document.documentElement.style.setProperty('--dashboard-primary-rgb', primaryRgb);
        document.documentElement.style.setProperty('--dashboard-button-accent', secondary);
        document.documentElement.style.setProperty('--dashboard-button-bg', buttonBackground);
        document.documentElement.style.setProperty('--dashboard-secondary', secondary);
        document.documentElement.style.setProperty('--dashboard-surface', surface);
        document.documentElement.style.setProperty('--bs-primary', primary);
        document.documentElement.style.setProperty('--bs-primary-rgb', primaryRgb);
        document.documentElement.style.setProperty('--bs-link-color', primary);
        document.documentElement.style.setProperty('--bs-link-hover-color', secondary);
        this.setBrowserThemeColor(primary);
    }

    private hasCustomizedTheme(theme: any): boolean {
        if (theme?.customized === true || theme?.is_customized === true) {
            return true;
        }

        const primary = this.normalizeColor(theme?.primary_color || theme?.primary || theme?.accent, '');
        return Boolean(primary && !['#ff7a1a', '#ff9f1a'].includes(primary.toLowerCase()));
    }

    private setBrowserThemeColor(color: string): void {
        let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }

        meta.content = color;
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
            return '255, 122, 26';
        }

        return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
    }

    protected toggleAssistant(): void {
        this.assistantOpen = !this.assistantOpen;
    }

    protected async installApp(): Promise<void> {
        if (this.deferredInstallPrompt) {
            const prompt = this.deferredInstallPrompt;
            this.deferredInstallPrompt = undefined;
            this.installAvailable = false;
            this.manualInstallHelp = false;
            await prompt.prompt();
            const choice = await prompt.userChoice;

            if (choice.outcome === 'accepted') {
                localStorage.setItem(this.installedStorageKey, 'true');
                this.installPromptOpen = false;
            } else {
                this.dismissInstallPrompt();
            }
            return;
        }

        if (this.iosInstallHelp) {
            this.manualInstallHelp = true;
            return;
        }

        this.manualInstallHelp = true;
    }

    protected dismissInstallPrompt(): void {
        this.installPromptOpen = false;
        this.installDismissedForCurrentView = true;
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
        const planName = this.subscriptionInfo.detail.replace('Paiement confirmé - ', '').replace('Essai gratuit - ', '') || 'votre plan';

        if (normalized.includes('commande')) {
            return `Surveillez vos commandes depuis le menu Orders. Les nouvelles commandes arrivent en temps réel avec son, badge et notification. Pour accélérer le service, traitez-les dans l'ordre pending -> preparing -> ready -> delivered.`;
        }

        if (normalized.includes('stat') || normalized.includes('revenu') || normalized.includes('vente')) {
            return `Votre plan permet les statistiques. Regardez le dashboard pour suivre les revenus par devise, les commandes du jour et les plats les plus commandés.`;
        }

        if (normalized.includes('qr') || normalized.includes('table')) {
            return `Pour ${restaurantName}, créez vos tables puis imprimez leurs QR codes. Chaque QR ouvre le menu client et rattache la commande à la bonne table.`;
        }

        if (normalized.includes('reservation')) {
            return this.canUse('reservations')
                ? `Les réservations sont actives sur ${planName}. Vos clients peuvent réserver depuis le menu public et vous confirmez ensuite dans Réservations.`
                : `Les réservations sont réservées aux plans Pro et Business.`;
        }

        if (normalized.includes('plan') || normalized.includes('abonnement') || normalized.includes('jour')) {
            return `${this.subscriptionInfo.label}. ${this.subscriptionInfo.expiresAt ? 'Fin prévue le ' + this.subscriptionInfo.expiresAt.toLocaleString() + '.' : this.subscriptionInfo.detail + '.'}`;
        }

        if (normalized.includes('plat') || normalized.includes('menu')) {
            return `Gardez votre menu court, clair et visuel. Mettez les plats populaires en avant, ajoutez des photos nettes et marquez rapidement les plats épuisés.`;
        }

        if (normalized.includes('fidel')) {
            return `Le module fidélité peut récompenser les clients après plusieurs commandes : points, tampons ou coupons. C'est idéal pour faire revenir les clients réguliers.`;
        }

        return `Je peux vous guider sur ${restaurantName} : commandes, QR codes, menu, réservations, statistiques, abonnement et idées de fidélisation. Essayez par exemple "Quels conseils pour vendre plus ?"`;
    }

    private prepareInstallPrompt(): void {
        window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', this.handleAppInstalled);
        window.addEventListener('focus', this.handleInstallFocusCheck);
        document.addEventListener('visibilitychange', this.handleInstallVisibilityCheck);
        this.refreshInstallHelpState();
    }

    private handleBeforeInstallPrompt = (event: Event): void => {
        event.preventDefault();
        this.deferredInstallPrompt = event as BeforeInstallPromptEvent;
        this.installAvailable = true;
        this.manualInstallHelp = false;
        void this.maybeShowInstallPrompt();
        this.cdref.detectChanges();
    };

    private handleAppInstalled = (): void => {
        this.deferredInstallPrompt = undefined;
        this.installAvailable = false;
        this.installPromptOpen = false;
        this.manualInstallHelp = false;
        this.cdref.detectChanges();
    };

    private handleInstallFocusCheck = (): void => {
        this.scheduleInstallPromptCheck(400);
    };

    private handleInstallVisibilityCheck = (): void => {
        if (!document.hidden) {
            this.scheduleInstallPromptCheck(400);
        }
    };

    private scheduleInstallPromptCheck(delay = 0): void {
        if (this.installPromptCheckTimer) {
            clearTimeout(this.installPromptCheckTimer);
        }

        this.installPromptCheckTimer = setTimeout(() => {
            void this.maybeShowInstallPrompt(true);
        }, delay);
    }

    private async maybeShowInstallPrompt(allowManualFallback = false): Promise<void> {
        this.refreshInstallHelpState();

        if (this.installPromptOpen || this.isStandaloneApp() || this.installDismissedForCurrentView) {
            return;
        }

        const installed = await this.isAppInstalled();
        if (installed) {
            this.handleAppInstalled();
            return;
        }

        if (this.installAvailable || this.iosInstallHelp) {
            this.manualInstallHelp = false;
            this.installPromptOpen = true;
            this.cdref.detectChanges();
        }
    }

    private refreshInstallHelpState(): void {
        this.iosInstallHelp = this.isIosDevice() && !this.isStandaloneApp();
        if (this.installAvailable || this.iosInstallHelp) {
            this.manualInstallHelp = false;
        }
    }

    private isStandaloneApp(): boolean {
        return window.matchMedia('(display-mode: standalone)').matches
            || Boolean((navigator as any).standalone);
    }

    private async isAppInstalled(): Promise<boolean> {
        if (this.isStandaloneApp() || localStorage.getItem(this.installedStorageKey) === 'true') {
            return true;
        }

        const getInstalledRelatedApps = (navigator as any).getInstalledRelatedApps;
        if (typeof getInstalledRelatedApps !== 'function') {
            return false;
        }

        try {
            const relatedApps = await getInstalledRelatedApps.call(navigator);
            return Array.isArray(relatedApps) && relatedApps.length > 0;
        } catch {
            return false;
        }
    }

    private isIosDevice(): boolean {
        return /iphone|ipad|ipod/i.test(navigator.userAgent);
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
                detail: `Paiement confirmé - ${planName}`,
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
            ? null : { mismatch: true };
    }

    onSubmit() {
        if (this.passwordForm.invalid) return;

        this.isLoading = true;
        this.authService.changePassword(this.passwordForm.value).subscribe({
            next: (res) => {
                this.isLoading = false;

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
                this.isLoading = false;
                const errorMessage = err.error?.message || 'Une erreur est survenue';

                Swal.fire({
                    title: 'Error',
                    text: errorMessage || 'Error during creation.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Réessayer'
                });
            }
        });
    }

    logout() {
        this.isLoading = true;

        this.authService.logout().subscribe({
            next: () => {
                this.cleanupBlockingOverlays();
                this.isLoading = false;
                this.router.navigate(['/restaurant/login'], { replaceUrl: true });
            },
            error: (err) => {
                Swal.fire({
                    title: 'Error',
                    text: err.error?.message || 'Error during disconnection.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Réessayer'
                });
                localStorage.clear();
                this.cleanupBlockingOverlays();
                this.isLoading = false;
                this.router.navigate(['/restaurant/login'], { replaceUrl: true });
            }
        });
    }

    private openFirstLoginPasswordModal(): void {
        const promptKey = `first_login_password_prompt_${this.userData?.email || this.userData?.firstName || 'user'}`;
        if (sessionStorage.getItem(promptKey)) {
            return;
        }

        this.cleanupIntroOverlay();
        const modalElement = document.getElementById('changePasswordModal');
        const bootstrapModal = (window as any).bootstrap?.Modal;

        if (modalElement && bootstrapModal) {
            sessionStorage.setItem(promptKey, 'true');
            bootstrapModal.getOrCreateInstance(modalElement).show();
        }
    }

    private cleanupIntroOverlay(): void {
        document.querySelectorAll('.introjs-overlay, .introjs-helperLayer, .introjs-tooltipReferenceLayer, .introjs-disableInteraction')
            .forEach((element) => element.remove());
        document.body.classList.remove('introjs-open');
    }

    private cleanupBlockingOverlays(): void {
        ['logoutModal', 'changePasswordModal'].forEach((id) => {
            const modalElement = document.getElementById(id);
            const modalInstance = modalElement ? (window as any).bootstrap?.Modal.getInstance(modalElement) : null;
            modalInstance?.hide();
            modalInstance?.dispose?.();
        });

        this.installPromptOpen = false;
        this.cleanupIntroOverlay();
        document.querySelectorAll('.modal-backdrop, .offcanvas-backdrop, .swal2-container')
            .forEach((element) => element.remove());
        document.body.classList.remove('modal-open', 'swal2-shown', 'swal2-height-auto');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
    }
}
