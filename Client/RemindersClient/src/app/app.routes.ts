import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Reminders } from './pages/reminders/reminders';
import { authGuard } from './auth/auth.guard';
import { ReminderDetails } from './pages/reminder-details/reminder-details';
import { CategoryDetails } from './pages/category-details/category-details';
import { adminGuard } from './auth/admin.guard';

export const routes: Routes = [
    {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile').then(module => module.Profile),
        canActivate: [authGuard],
        title: 'Мой профиль — Reminders'
    },
    {
        path: 'reports/:id',
        loadComponent: () => import('./pages/admin-report/admin-report').then(module => module.AdminReport),
        canActivate: [authGuard, adminGuard],
        title: 'Отчёт — Reminders'
    },
    {
        path: 'reports',
        loadComponent: () => import('./pages/reports/reports').then(module => module.Reports),
        canActivate: [authGuard, adminGuard],
        title: 'Отчёты — Reminders'
    },
    {
        path: 'register',
        loadComponent: () => import('./pages/register/register').then(module => module.Register),
        title: 'Регистрация — Reminders'
    },
    {
        path: 'notifications/:id',
        loadComponent: () => import('./pages/notification-details/notification-details').then(module => module.NotificationDetails),
        canActivate: [authGuard],
        title: 'Уведомление — Reminders'
    },
    {
        path: 'notifications',
        loadComponent: () => import('./pages/notifications/notifications').then(module => module.Notifications),
        canActivate: [authGuard],
        title: 'Уведомления — Reminders'
    },
    {
        path: '',
        redirectTo: 'reminders',
        pathMatch: 'full'
    },
    {
        path: 'login',
        component: Login
    },
    {
        path: 'reminders/:id',
        component: ReminderDetails,
        canActivate: [authGuard],
        title: 'Напоминание — Reminders'
    },
    {
        path: 'categories/:id',
        component: CategoryDetails,
        canActivate: [authGuard],
        title: 'Категория — Reminders'
    },
    {
        path: "reminders",
        component: Reminders,
        canActivate: [authGuard]
    }
];
