import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

/**
 * Composant racine de l'application.
 * Contient le layout principal avec la barre de navigation.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],
  template: `
    <div class="app-container">
      <!-- Navigation -->
      <nav class="navbar">
        <a href="/" class="navbar-brand">📷 Gestion Photos</a>
        <div class="navbar-actions">
          <a routerLink="/photos" routerLinkActive="active" class="nav-link">Galerie</a>
          <a routerLink="/upload" routerLinkActive="active" class="nav-link">Uploader</a>
        </div>
      </nav>

      <!-- Main Content -->
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>

      <!-- Footer -->
      <footer class="footer">
        <p>Application de gestion de photos - Développée avec Spring Boot & Angular</p>
      </footer>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #2196F3;
      color: white;
      padding: 15px 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      .navbar-brand {
        font-size: 18px;
        font-weight: 500;
        color: white;
        text-decoration: none;
      }

      .navbar-actions {
        display: flex;
        gap: 20px;

        .nav-link {
          color: white;
          text-decoration: none;
          padding: 5px 10px;
          border-radius: 4px;
          transition: background-color 0.2s;

          &:hover {
            background-color: rgba(255, 255, 255, 0.1);
          }

          &.active {
            background-color: rgba(255, 255, 255, 0.2);
            font-weight: 500;
          }
        }
      }
    }

    .main-content {
      flex: 1;
      padding: 20px;
    }

    .footer {
      background-color: #f5f5f5;
      border-top: 1px solid #ddd;
      padding: 15px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  `]
})
export class AppComponent {
  title = 'Gestion Photos';
}
