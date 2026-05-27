import {Component, signal} from "@angular/core";
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {TableService} from "../../../services/table/table-service";
import Swal from "sweetalert2";

@Component({
    selector: "app-create-table",
    imports: [
        FormsModule,
        ReactiveFormsModule
    ],
    templateUrl: "./create-table.html",
    styleUrl: "./create-table.scss",
    standalone: true
})
export class CreateTable {
    isLoading = false;

    // Utilisation de signaux pour les états si nécessaire (optionnel selon votre logique de template)
    name = signal('');

    constructor(private tableService: TableService) {}

    // 1. Mise à jour du formulaire avec 'capacity'
    tableForm = new FormGroup({
        name: new FormControl('', [Validators.required]),
        capacity: new FormControl('', [Validators.required, Validators.min(1)]), // Ajouté
    });

    onSubmit() {
        if (this.tableForm.valid) {
            this.isLoading = true;
            const formData = new FormData();

            // --- LOGIQUE DE FORMATAGE ---
            const rawName = this.tableForm.value.name || '';

            // On cherche une transition entre lettres (\D) et chiffres (\d)
            // pour insérer un espace, puis on nettoie les espaces en trop.
            const formattedName = rawName
                .replace(/(\D+)(\d+)/g, '$1 $2') // Ajoute l'espace (ex: TABLE1 -> TABLE 1)
                .replace(/\s+/g, ' ')            // Évite les doubles espaces si l'utilisateur en a déjà mis un
                .toUpperCase()                   // Force en MAJUSCULES pour la cohérence
                .trim();                         // Supprime les espaces au début/fin

            // Ajout au FormData
            formData.append('name', formattedName);
            formData.append('capacity', this.tableForm.value.capacity!.toString());

            this.createTable(formData);
        } else {
            this.tableForm.markAllAsTouched();
        }
    }

    createTable(data: FormData) {
        this.isLoading = true;
        this.tableService.create(data).subscribe({
            next: (response) => {
                console.log(response);
                this.isLoading = false;
                Swal.fire({
                    title: 'Succès !',
                    text:
                        'The table was successfully created.',
                    icon: 'success',
                    confirmButtonText: 'Close',
                    timer: 2000,
                    confirmButtonColor: '#28a745'
                }).then(() => {
                    // Note : Pensez à utiliser le Router plutôt que reload() pour une meilleure UX
                    window.location.reload();
                });
            },
            error: (err) => {
                this.isLoading = false;
                Swal.fire({
                    title: 'Erreur',
                    text: err.error?.message || 'Erreur lors de la création.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Réessayer'
                });
            }
        });
    }
}