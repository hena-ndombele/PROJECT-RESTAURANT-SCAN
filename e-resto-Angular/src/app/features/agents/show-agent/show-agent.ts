import {Component, Input, OnInit} from "@angular/core";
import {AgentDto} from "../../../models/agents/AgentDto";
import {DatePipe} from "@angular/common";

@Component({
  selector: "app-show-agent",
    imports: [
        DatePipe
    ],
  templateUrl: "./show-agent.html",
  styleUrl: "./show-agent.scss",
  standalone:true
})
export class ShowAgent implements OnInit{
  @Input() agent:AgentDto | undefined;
  @Input() agentId:string | null = null;
  agentDetail!: AgentDto;

  ngOnInit() {
    if(this.agent) {
      this.agentDetail = this.agent;
    }
  }

}
