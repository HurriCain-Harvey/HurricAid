import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material';
import { SignupComponent } from '../signup/signup.component';
import { LoginComponent } from '../login/login.component';
import { InfoComponent } from '../info/info.component';
import { Router } from '@angular/router';
import { MapsService } from '../service/maps.service';
import { HttpClient } from '@angular/common/http';
import { keys } from 'config';

export interface DialogData {

}

@Component({
  selector: 'app-splash',
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.css']
})
export class SplashComponent implements OnInit {

  lat: string = '';
  lng: string = '';
  imgSrc: string = '../../hurricane.png'; 
  article: any;
  newsDisplay: boolean = false;
  logged: boolean = false;
  name: string = 'Please Log In';

  constructor(public dialog: MatDialog, private router: Router, private map: MapsService, private http: HttpClient) { }

  ngOnInit() {
  this.map.getLocation().subscribe(data => {
  this.lat = data.latitude;
  this.lng = data.longitude;
  this.http.get((`https://api.predicthq.com/v1/events/?category=severe-weather,disasters,terror&within=50km@${this.lat},${this.lng}`), 
    { headers: { Authorization: `Bearer ${keys.predictHQ}` }})
      .subscribe((response: any) => {
        if (response['results'].length === 0){
          this.newsDisplay = true;
        } else {
          this.article = response.results[0].title + ' (Click for more information.)';
        }
      })
    })
    this.http.get('/getInfo').subscribe((info: any) => {
      if (!info) {
        this.logged = false;
        this.name = 'Please Log In';
      } else {
        this.logged = true;
        this.name = info.usr.name_first;
      }
    });
  }
  moveToMap() {
    this.router.navigate(['/map']);
  }
  loginBox(): void {
    this.dialog.open(LoginComponent, {
      width: '300px',
    });
  }
  signUpBox(): void {
    this.dialog.open(SignupComponent, {
      width: '300px',
    });
  }
  info() {
    this.dialog.open(InfoComponent, {
      width: '300px',
    });
  }
  logout(): void {
    this.logged = false;
    this.http.get('/logout').subscribe(() => {
      this.router.navigate(['/']);
    });
  }
}
