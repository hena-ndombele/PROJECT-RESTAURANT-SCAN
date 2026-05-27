import {Component, ElementRef, OnInit, ViewChild} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {Router, RouterLink} from "@angular/router";
import {CommonModule} from "@angular/common";
import {AuthService} from "../../../services/auth/auth-service";
import Swal from 'sweetalert2';


@Component({
  selector: "app-otp",
  imports: [
    FormsModule,
    RouterLink,
      CommonModule,
  ],
  templateUrl: "./otp.html",
  styleUrl: "./otp.scss",
})
export class Otp implements OnInit {
  isLoading=false;

  digits = ['', '', '', '', ''];

  @ViewChild('otp1') otp1!: ElementRef;
  @ViewChild('otp2') otp2!: ElementRef;
  @ViewChild('otp3') otp3!: ElementRef;
  @ViewChild('otp4') otp4!: ElementRef;
  @ViewChild('otp5') otp5!: ElementRef;

  error: string | null = null;
  email: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.authService.currentEmail.subscribe(email => {
      this.email = email;
      if (!this.email || this.email === '') {
        console.warn("Aucun email trouvé, retour au login.");
        this.router.navigate(['/auth/login']);
      }
    });
  }

  onKeyUp(event: KeyboardEvent, index: number) {
    const input = event.target as HTMLInputElement;
    const key = event.key;
    if (input.value && index < 4 && key !== 'Backspace') {
      const nextInput = this[`otp${index + 2}` as keyof Otp] as ElementRef;
      nextInput.nativeElement.focus();
    }

    if (key === 'Backspace' && index > 0 && !input.value) {
      const prevInput = this[`otp${index}` as keyof Otp] as ElementRef;
      prevInput.nativeElement.focus();
    }
  }

  verifyOtp() {
    this.isLoading=true;
    const fullCode = [this.otp1, this.otp2, this.otp3, this.otp4, this.otp5]
        .map(el => el.nativeElement.value)
        .join('');
    console.log("Email utilisé:", this.email);
    console.log("Code construit:", fullCode);

    if (fullCode.length < 5) {
      this.error = "\n" +
          "Please enter the 5 digits of the code.";
      return;
    }

    this.authService.verifyOtp(this.email, fullCode).subscribe({
      next: (res) => {
        this.authService.saveToken(res.token);
        this.isLoading=false;
        this.router.navigate(['/dashboard']);
        console.log("res otp************", res);
      },
      error: (err) => {
        this.isLoading=false;
        Swal.fire({
          title: 'Error',
          text: err.error?.message || '\n' +
              'OTP Incorrect.',
          icon: 'error',
          confirmButtonColor: '#d33',
          confirmButtonText: 'Try again'
        });
        console.log("res otp************",err)
        this.error = err.error?.message || "\n" +
            "Invalid or expired code."
      }
    });
  }
}
