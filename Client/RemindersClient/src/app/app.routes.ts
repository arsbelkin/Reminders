import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Reminders } from './pages/reminders/reminders';
import { authGuard } from './auth/auth.guard';
import { ReminderDetails } from './pages/reminder-details/reminder-details';
import { CategoryDetails } from './pages/category-details/category-details';

export const routes: Routes = [
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
