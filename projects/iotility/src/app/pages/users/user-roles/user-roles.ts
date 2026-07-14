import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-user-roles',
  templateUrl: './user-roles.html',
  styleUrl: './user-roles.css',
})
export class UserRoles {
  protected readonly showAll = signal(false);
  protected readonly roles = [
    { name: 'Super Admin', category: 'System User', users: 23 },
    { name: 'Workshop Owners', category: 'Workshop Users', users: 23 },
    { name: 'Fleet Manager', category: 'System User', users: 23 },
    { name: 'Workshop Mechanics', category: 'Workshop Users', users: 23 },
    { name: 'Support', category: 'System User', users: 23 },
    { name: 'Administrator', category: 'System User', users: 18 },
    { name: 'Driver', category: 'Driver App User', users: 42 },
    { name: 'Dispatcher', category: 'System User', users: 12 },
  ];
}
