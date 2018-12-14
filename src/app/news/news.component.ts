import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MapsService } from '../service/maps.service';
import { keys } from 'config';
import * as moment from 'moment';

@Component({
  selector: 'app-news',
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.css']
})
export class NewsComponent implements OnInit {

  lat: any;
  lng: any;
  articles: Array<object>;
  newsDisplay: boolean = false;
  zoom: number = 8;
  gestureHandling: string = 'cooperative';
  supplyOptions: any = [];
  markers: any = [];

  constructor(private map: MapsService, private http: HttpClient) { }

  ngOnInit() {
    this.map.getLocation().subscribe(data => {
      this.lat = data.latitude;
      this.lng = data.longitude;
      this.http.get((`https://api.predicthq.com/v1/events/?sort=start&start.gte=2018-12-14&category=severe-weather,disasters,terror&within=100km@${this.lat},${this.lng}`), 
      { headers: { Authorization: `Bearer ${keys.predictHQ}` }})
      .subscribe((response: any) => {
        if (response['results'].length === 0){
          this.newsDisplay = true;
        } else {
          this.articles = response['results'];
          for (let i = 0; i < response.results.length; i++) {
            this.markers.push({
              title: response.results[i].title,
              status: response.results[i].state,
              desc: response.results[i].description,
              start: moment(response.results[i].start).format('LT'),
              end: moment(response.results[i].end).format('LT'),
              lat: response.results[i].location[1],
              lng: response.results[i].location[0],
            });
          }
        }
      })
    })
  }
}
