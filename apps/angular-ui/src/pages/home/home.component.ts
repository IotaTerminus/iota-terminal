import { ChangeDetectorRef, Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getActiveBackend, getApiBaseUrl, type BackendId } from '../../backend';
import type { SystemStatus } from '@iota/types';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <iota-window title="~/home">
      <p>angular-ui &mdash; active backend: {{ activeBackend }}</p>
      <pre>{{ status ? (status | json) : 'connecting...' }}</pre>
      <iota-cursor></iota-cursor>
    </iota-window>
  `
})
export class HomeComponent implements OnInit {
  activeBackend: BackendId = getActiveBackend();
  status: SystemStatus | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    fetch(`${getApiBaseUrl()}/system/status`)
      .then((res) => res.json())
      .then((data: SystemStatus) => {
        this.status = data;
        this.cdr.detectChanges();
      })
      .catch((err) => {
        this.status = null;
        this.cdr.detectChanges();
      });
  }
}
