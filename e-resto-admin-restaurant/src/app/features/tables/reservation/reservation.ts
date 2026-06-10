import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnDestroy, OnInit, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SaasService } from "../../../services/saas/saas-service";
import { ReservationDto, Réservationservice, Réservationstatus } from "../../../services/reservation/reservation-service";
import { OrderRealtimeService } from "../../../services/realtime/order-realtime-service";
import { Subscription } from "rxjs";

@Component({
  selector: "app-reservation",
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: "./reservation.html",
  styleUrl: "./reservation.scss",
  standalone:true
})
export class Reservation implements OnInit, OnDestroy {
  Réservations = signal<ReservationDto[]>([]);
  selectedReservation = signal<ReservationDto | null>(null);
  loading = signal(false);
  errorMessage = signal("");
  successMessage = signal("");
  updatingId = signal<string | null>(null);
  statusFilter = signal<Réservationstatus | "all">("all");
  dateFilter = signal("");
  searchTerm = signal("");
  internalNote = signal("");
  cancellationReason = signal("");
  upgradeRequired = signal(false);
  private realtimeSubscription?: Subscription;

  readonly statusOptions: { value: Réservationstatus; label: string; icon: string }[] = [
    { value: "pending", label: "En attente", icon: "bi-hourglass" },
    { value: "confirmed", label: "Confirmee", icon: "bi-calendar-check" },
    { value: "seated", label: "Installee", icon: "bi-person-check" },
    { value: "completed", label: "Terminee", icon: "bi-check2-circle" },
    { value: "cancelled", label: "Annulee", icon: "bi-x-circle" },
    { value: "no_show", label: "No-show", icon: "bi-person-x" },
  ];

  filteredRéservations = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();

    return this.Réservations().filter((reservation) => {
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
    { value: "all" as const, label: "Toutes", count: this.Réservations().length },
    ...this.statusOptions.map((item) => ({
      ...item,
      count: this.Réservations().filter((reservation) => reservation.status === item.value).length
    }))
  ]);

  constructor(
    private Réservationservice: Réservationservice,
    private saasService: SaasService,
    private realtime: OrderRealtimeService
  ) {}

  ngOnInit(): void {
    this.loadUsage();
    this.loadRéservations();
    this.realtimeSubscription = this.realtime.reservationCreated$.subscribe((reservation) => {
      this.Réservations.update((list) => list.some((item) => item.id === reservation.id) ? list : [reservation, ...list]);
      this.successMessage.set("Nouvelle reservation recue.");
    });
  }

  ngOnDestroy(): void {
    this.realtimeSubscription?.unsubscribe();
  }

  loadUsage(): void {
    this.saasService.restaurantUsage().subscribe({
      next: (usage) => this.upgradeRequired.set(usage.permissions?.can_use_Réservations === false),
      error: () => this.upgradeRequired.set(false),
    });
  }

  loadRéservations(): void {
    this.loading.set(true);
    this.errorMessage.set("");
    this.successMessage.set("");

    this.Réservationservice.list({
      status: this.statusFilter(),
      date: this.dateFilter(),
    }).subscribe({
      next: (Réservations) => {
        this.Réservations.set(Réservations);
        this.loading.set(false);
      },
      error: (error) => {
        if (error?.status === 403 || error?.error?.requires_upgrade) {
          this.upgradeRequired.set(true);
          this.errorMessage.set(error?.error?.message || "Les Réservations sont reservees aux plans Pro et Business.");
        } else {
          this.errorMessage.set("Impossible de charger les Réservations.");
        }
        this.Réservations.set([]);
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

  updateStatus(reservation: ReservationDto, status: Réservationstatus): void {
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

    this.Réservationservice.updateStatus(reservation.id, {
      status,
      internal_note: this.internalNote() || undefined,
      cancellation_reason: status === "cancelled" ? this.cancellationReason() : undefined,
    }).subscribe({
      next: (updated) => {
        this.Réservations.update((list) => list.map((item) => item.id === updated.id ? updated : item));
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
    if (!window.confirm("Supprimer cette reservation ?")) return;
    this.Réservationservice.delete(reservation.id).subscribe({
      next: () => {
        this.Réservations.update((list) => list.filter((item) => item.id !== reservation.id));
        this.closeReservation();
        this.successMessage.set("Reservation supprimee.");
      },
      error: () => this.errorMessage.set("Impossible de supprimer la reservation.")
    });
  }

  statusLabel(status: Réservationstatus): string {
    return this.statusOptions.find((item) => item.value === status)?.label || status;
  }

  statusClass(status: Réservationstatus): string {
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
