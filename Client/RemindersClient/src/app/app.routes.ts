import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Reminders } from './pages/reminders/reminders';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
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
        path: "reminders",
        component: Reminders,
        canActivate: [authGuard]
    }
];
