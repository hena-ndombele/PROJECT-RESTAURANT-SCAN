import { CommonModule, DatePipe } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { API_ROOT } from "../../../services/api-url";

type Feedback = {
  id: string;
  food_rating: number;
  service_rating: number;
  ordering_rating: number;
  recommended: boolean | null;
  comment?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  created_at?: string;
  order?: {
    id: string;
    total_amount?: number;
    currency?: string;
    table?: { id: string; name: string } | null;
  } | null;
  table?: { id: string; name: string } | null;
};

@Component({
  selector: "app-list-feedback",
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: "./list-feedback.html",
  styleUrl: "./list-feedback.scss",
  standalone:true
})
export class ListFeedback implements OnInit {
  private readonly http = inject(HttpClient);

  feedbacks = signal<Feedback[]>([]);
  loading = signal(false);
  errorMessage = signal("");
  recommendationFilter = signal<"all" | "yes" | "no">("all");
  minRating = signal<number>(0);

  filteredFeedbacks = computed(() => {
    const recommendation = this.recommendationFilter();
    const min = Number(this.minRating() || 0);

    return this.feedbacks().filter((feedback) => {
      const avg = this.averageRating(feedback);
      const matchesRating = avg >= min;
      const matchesRecommendation = recommendation === "all"
        || (recommendation === "yes" && feedback.recommended === true)
        || (recommendation === "no" && feedback.recommended === false);

      return matchesRating && matchesRecommendation;
    });
  });

  averageScore = computed(() => {
    const list = this.filteredFeedbacks();
    if (!list.length) return 0;
    return list.reduce((total, feedback) => total + this.averageRating(feedback), 0) / list.length;
  });

  recommendRate = computed(() => {
    const answered = this.filteredFeedbacks().filter((feedback) => feedback.recommended !== null);
    if (!answered.length) return 0;
    return Math.round((answered.filter((feedback) => feedback.recommended).length / answered.length) * 100);
  });

  ngOnInit(): void {
    this.loadFeedbacks();
  }

  loadFeedbacks(): void {
    this.loading.set(true);
    this.errorMessage.set("");

    this.http.get<any>(`${API_ROOT}/feedbacks`).subscribe({
      next: (response) => {
        const list = Array.isArray(response) ? response : (response.feedbacks || response.data || []);
        this.feedbacks.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set("Impossible de charger les feedbacks clients.");
        this.feedbacks.set([]);
        this.loading.set(false);
      }
    });
  }

  averageRating(feedback: Feedback): number {
    return (
      Number(feedback.food_rating || 0)
      + Number(feedback.service_rating || 0)
      + Number(feedback.ordering_rating || 0)
    ) / 3;
  }

  tableName(feedback: Feedback): string {
    return feedback.order?.table?.name || feedback.table?.name || "Table inconnue";
  }

  orderRef(feedback: Feedback): string {
    return feedback.order?.id ? `#${feedback.order.id.slice(0, 8).toUpperCase()}` : "Sans commande";
  }
}
