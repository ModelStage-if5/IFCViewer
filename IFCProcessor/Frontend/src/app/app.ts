import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IfcViewerComponent } from './components/ifc-viewer/ifc-viewer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, IfcViewerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected title = 'IFC Processor';
}
