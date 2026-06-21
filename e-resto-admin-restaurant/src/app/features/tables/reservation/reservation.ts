import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnDestroy, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SaasService } from "../../../services/saas/saas-service";
import { ReservationDto, ReservationService, ReservationStatus } from "../../../services/reservation/reservation-service";
import { OrderRealtimeService } from "../../../services/realtime/order-realtime-service";
import { Subscription } from "rxjs";
import { AppPermissionService } from "../../../services/auth/permission-service";

@Component({
  selector: "app-reservation",
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: "./reservation.html",
  styleUrl: "./reservation.scss",
  standalone: true
})
export class Reservation implements OnInit, OnDestroy {
  private permissions = inject(AppPermissionService);
  Reservations = signal<ReservationDto[]>([]);

  selectedReservation = signal<ReservationDto | null>(null);
  loading = signal(false);
  errorMessage = signal("");
  successMessage = signal("");
  updatingId = signal<string | null>(null);
  statusFilter = signal<ReservationStatus | "all">("all");
  dateFilter = signal("");
  searchTerm = signal("");
  internalNote = signal("");
  cancellationReason = signal("");
  upgradeRequired = signal(false);
  private realtimeSubscription?: Subscription;

  readonly statusOptions: { value: ReservationStatus; label: string; icon: string }[] = [
    { value: "pending", label: "En attente", icon: "bi-hourglass" },
    { value: "confirmed", label: "Confirmee", icon: "bi-calendar-check" },
    { value: "seated", label: "Installee", icon: "bi-person-check" },
    { value: "completed", label: "Terminee", icon: "bi-check2-circle" },
    { value: "cancelled", label: "Annulee", icon: "bi-x-circle" },
    { value: "no_show", label: "No-show", icon: "bi-person-x" },
  ];

  filteredReservations = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();

    return this.Reservations().filter((reservation) => {
      const matchesStatus = status === "all" || reservation.status === status;
      const haystack = [
        reservation.name,
        reservation.phone,
        reservation.email,
        reservation.table?.name,
        reservation.status,
      ].join(" ").toLowerCase();

      return matchesStatus && (!term || haystack.includes(term));
    });
  });

  statusTabs = computed(() => [
    { value: "all" as const, label: "Toutes", count: this.Reservations().length },
    ...this.statusOptions.map((item) => ({
      ...item,
      count: this.Reservations().filter((reservation) => reservation.status === item.value).length
    }))
  ]);

  constructor(
    private reservationService: ReservationService,
    private saasService: SaasService,
    private realtime: OrderRealtimeService
  ) {}

  ngOnInit(): void {
    this.loadUsage();
    this.loadReservations();
    this.realtimeSubscription = this.realtime.reservationCreated$.subscribe((reservation) => {
      this.Reservations.update((list) => list.some((item) => item.id === reservation.id) ? list : [reservation, ...list]);
      this.successMessage.set("Nouvelle reservation recue.");
    });
  }

  ngOnDestroy(): void {
    this.realtimeSubscription?.unsubscribe();
  }

  canAccess(permission: string): boolean {
    return this.permissions.has(permission);
  }

  loadUsage(): void {
    this.saasService.restaurantUsage().subscribe({
      next: (usage) => this.upgradeRequired.set(usage.permissions?.can_use_reservations === false),
      error: () => this.upgradeRequired.set(false),
    });
  }

  loadReservations(): void {
    this.loading.set(true);
    this.errorMessage.set("");
    this.successMessage.set("");

    this.reservationService.list({
      status: this.statusFilter(),
      date: this.dateFilter(),
    }).subscribe({
      next: (reservations) => {
        this.Reservations.set(reservations);
        this.loading.set(false);
      },
      error: (error) => {
        if (error?.status === 403 || error?.error?.requires_upgrade) {
          this.upgradeRequired.set(true);
          this.errorMessage.set(error?.error?.message || "Les reservations sont reservees aux plans Pro et Business.");
        } else {
          this.errorMessage.set("Impossible de charger les reservations.");
        }
        this.Reservations.set([]);
        this.loading.set(false);
      }
    });
  }

  openReservation(reservation: ReservationDto): void {
    this.selectedReservation.set(reservation);
    this.internalNote.set(reservation.internal_note || "");
    this.cancellationReason.set("");
  }

  closeReservation(): void {
    this.selectedReservation.set(null);
    this.internalNote.set("");
    this.cancellationReason.set("");
  }

  updateStatus(reservation: ReservationDto, status: ReservationStatus): void {
    if (!this.canAccess("reservations.update")) {
      this.errorMessage.set("Vous n'avez pas la permission de modifier le statut des reservations.");
      return;
    }
    if (!reservation.id || this.updatingId() === reservation.id) return;
    if (status === "cancelled" && !this.cancellationReason().trim()) {
      this.cancellationReason.set(window.prompt("Motif d'annulation ?") || "");
      if (!this.cancellationReason().trim()) {
        this.errorMessage.set("Le motif d'annulation est obligatoire.");
        return;
      }
    }

    this.updatingId.set(reservation.id);
    this.errorMessage.set("");
    this.successMessage.set("");

    this.reservationService.updateStatus(reservation.id, {
      status,
      internal_note: this.internalNote() || undefined,
      cancellation_reason: status === "cancelled" ? this.cancellationReason() : undefined,
    }).subscribe({
      next: (updated) => {
        this.Reservations.update((list) => list.map((item) => item.id === updated.id ? updated : item));
        this.selectedReservation.set(updated);
        this.internalNote.set(updated.internal_note || "");
        this.cancellationReason.set("");
        this.successMessage.set("Reservation mise a jour.");
        this.updatingId.set(null);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || "Impossible de modifier la reservation.");
        this.updatingId.set(null);
      }
    });
  }

  deleteReservation(reservation: ReservationDto): void {
    if (!this.canAccess("reservations.delete")) {
      this.errorMessage.set("Vous n'avez pas la permission de supprimer les reservations.");
      return;
    }
    if (!window.confirm("Supprimer cette reservation ?")) return;
    this.reservationService.delete(reservation.id).subscribe({
      next: () => {
        this.Reservations.update((list) => list.filter((item) => item.id !== reservation.id));
        this.closeReservation();
        this.successMessage.set("Reservation supprimee.");
      },
      error: () => this.errorMessage.set("Impossible de supprimer la reservation.")
    });
  }

  statusLabel(status: ReservationStatus): string {
    return this.statusOptions.find((item) => item.value === status)?.label || status;
  }

  statusClass(status: ReservationStatus): string {
    return {
      pending: "bg-warning text-dark",
      confirmed: "bg-primary",
      seated: "bg-info text-dark",
      completed: "bg-success",
      cancelled: "bg-danger",
      no_show: "bg-secondary",
    }[status] || "bg-secondary";
  }
}
