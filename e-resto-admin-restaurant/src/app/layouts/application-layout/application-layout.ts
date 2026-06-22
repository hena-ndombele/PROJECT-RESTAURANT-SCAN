import { Component } from "@angular/core";
import {Header} from "../header/header";
import {Sidebare} from "../sidebare/sidebare";
import {RouterOutlet} from "@angular/router";

@Component({
  selector: "app-application-layout",
  imports: [
    Header,
    Sidebare,
    RouterOutlet
  ],
  templateUrl: "./application-layout.html",
  styleUrl: "./application-layout.scss",
})
export class ApplicationLayout {
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
}
