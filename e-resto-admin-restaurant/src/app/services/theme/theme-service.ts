import { Injectable, signal } from "@angular/core";

type ThemeMode = "light" | "dark";

@Injectable({
    providedIn: "root"
})
export class ThemeService {
    readonly mode = signal<ThemeMode>((localStorage.getItem("dashboard_theme") as ThemeMode) || "light");

    constructor() {
        this.applyTheme(this.mode());
    }

    toggle(): void {
        const nextMode: ThemeMode = this.mode() === "dark" ? "light" : "dark";
        this.mode.set(nextMode);
        localStorage.setItem("dashboard_theme", nextMode);
        this.applyTheme(nextMode);
    }

    private applyTheme(mode: ThemeMode): void {
        document.body.classList.toggle("dashboard-dark-theme", mode === "dark");
    }
}
