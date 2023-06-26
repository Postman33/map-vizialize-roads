import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { MapComponent } from './components/map/map.component';
import {HttpClientModule} from "@angular/common/http";
import {SidebarModule} from "primeng/sidebar";
import {ButtonModule} from "primeng/button";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {ProgressBarModule} from "primeng/progressbar";
import {CardModule} from "primeng/card";
import {FieldsetModule} from "primeng/fieldset";
import {ScrollPanelModule} from "primeng/scrollpanel";
import { TooltipModule } from 'primeng/tooltip';

@NgModule({
  declarations: [
    AppComponent,
    MapComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    SidebarModule,
    ButtonModule,
    BrowserAnimationsModule,
    ProgressBarModule,
    CardModule,
    FieldsetModule,
    ScrollPanelModule,
    TooltipModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
