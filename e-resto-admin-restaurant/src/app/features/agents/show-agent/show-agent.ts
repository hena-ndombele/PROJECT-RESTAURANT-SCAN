import { Component, Input, OnInit } from "@angular/core";
import { DatePipe } from "@angular/common";
import { AgentDto } from "../../../models/agents/AgentDto";

@Component({
  selector: "app-show-agent",
  imports: [
    DatePipe
  ],
  templateUrl: "./show-agent.html",
  styleUrl: "./show-agent.scss",
  standalone: true
})
export class ShowAgent implements OnInit {
  @Input() agent: AgentDto | undefined;
  @Input() agentId: string | null = null;
  agentDetail!: AgentDto;

  ngOnInit() {
    if (this.agent) {
      this.agentDetail = this.agent;
    }
  }

  initials(): string {
    return `${this.agentDetail?.first_name?.[0] || ""}${this.agentDetail?.last_name?.[0] || ""}`.toUpperCase() || "RS";
  }
}
