import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AccountMenu } from './components/account-menu/account-menu';
import { TokenStorageService } from './auth/token-storage.service';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AccountMenu],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  readonly tokenStorage = inject(TokenStorageService);
}
