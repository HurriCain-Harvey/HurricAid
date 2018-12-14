import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../service/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  loggedIn: boolean = false;
  model: any = {};
  hide: boolean = false;

  constructor(private http: HttpClient, private router: Router, private authService: AuthService) { }

  ngOnInit() {
  }
  moveToMap() {
    this.router.navigate(['/map']);
  }
  @Output() logEvent = new EventEmitter<boolean>();
  sendlog() {
    this.loggedIn = true;
    this.logEvent.emit(this.loggedIn);
  }
  login() {
    this.http.post("/login", { email: this.model.email, password: this.model.password })
    .subscribe((data) => {
      if (data === true) {
        this.authService.login(true);
        this.router.navigateByUrl('/map');
      } else {
        this.router.navigateByUrl('/login');
      }
    });
  }
}
