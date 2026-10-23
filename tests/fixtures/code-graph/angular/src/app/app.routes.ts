import { Routes } from '@angular/router';

import { UsersComponent } from './users/users.component';

export const routes: Routes = [
    { path: '', component: UsersComponent },
    { path: 'admin', loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent) },
    { path: 'legacy', redirectTo: '' },
];

export const settings = { path: 'not/a/route', mode: 'dark' };
