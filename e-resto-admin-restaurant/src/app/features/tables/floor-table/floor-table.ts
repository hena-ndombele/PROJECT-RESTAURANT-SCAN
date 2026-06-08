import { Component, inject, OnInit, signal } from "@angular/core";
import { TableService } from "../../../services/table/table-service";
import { NgClass } from "@angular/common";

@Component({
    selector: "app-floor-table",
    imports: [
        NgClass
    ],
    templateUrl: "./floor-table.html",
    styleUrl: "./floor-table.scss",
    standalone: true
})
export class FloorTable implements OnInit {
    tables = signal<any[]>([]);
    isLoading = signal<boolean>(false); // Le signal que ton HTML surveille

    private tableService = inject(TableService);

    ngOnInit() {
        this.loadTables(); // On appelle la méthode au chargement initial
    }

    /**
     * Charge les tables depuis le service
     * Cette méthode est liée à ton bouton (click)="loadTables()"
     */
    loadTables() {
        this.isLoading.set(true); // Active le spinner et grise le bouton

        this.tableService.list().subscribe({
            next: (data) => {
                this.tables.set(data);
                // On simule un léger délai pour que l'utilisateur voit l'animation
                // (Optionnel, tu peux mettre direct false)
                setTimeout(() => this.isLoading.set(false), 600);
            },
            error: (err) => {
                console.error('Erreur chargement tables:', err);
                this.isLoading.set(false); // On coupe le loading même si ça échoue
            }
        });
    }

    getStatusClass(status: string): string {
        switch (status) {
            case 'Libre': return 'libre';
            case 'Occupée': return 'occupied';
            case 'Réservée': return 'ordering';
            default: return '';
        }
    }
}