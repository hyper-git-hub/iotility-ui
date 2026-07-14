import { Component } from '@angular/core';
import { DataTable, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { UserRoles } from './user-roles/user-roles';

@Component({
  selector: 'app-users-page',
  imports: [DataTable, UserRoles],
  templateUrl: './users-page.html',
})
export class UsersPage {
  protected readonly tableActions: TableAction[] = ['view', 'edit', 'delete'];
  protected readonly columns: TableColumn[] = [
    { key: 'name', label: 'Name', type: 'user', secondaryKey: 'role', widthClass: 'min-w-44' },
    { key: 'email', label: 'Email', type: 'email', widthClass: 'min-w-48' },
    { key: 'userType', label: 'User Type' },
    { key: 'createdBy', label: 'Created by' },
    { key: 'createdDate', label: 'Create Date', type: 'date', widthClass: 'min-w-40' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'actions', label: 'Actions', type: 'actions', widthClass: 'min-w-48' },
  ];

  protected readonly users: TableRow[] = [
    {
      name: 'Hanna Rhiel Madsen',
      role: 'Super Admin',
      email: 'hanna@iotility.com',
      userType: 'System User',
      createdBy: 'Haris Khan',
      createdDate: '15th March, 2025',
      status: 'Active',
      actions: '',
    },
    {
      name: 'Angel Dokidis',
      role: 'Admin',
      email: 'angel@iotility.com',
      userType: 'System User',
      createdBy: 'Haris Khan',
      createdDate: '05th March, 2025',
      status: 'Active',
      actions: '',
    },
    {
      name: 'Cooper Vetrovs',
      role: 'Admin',
      email: 'cooper@iotility.com',
      userType: 'Workshop User',
      createdBy: 'Haris Khan',
      createdDate: '13th April, 2025',
      status: 'Active',
      actions: '',
    },
    {
      name: 'Omar Levin',
      role: 'Admin',
      email: 'omar@iotility.com',
      userType: 'System User',
      createdBy: 'Haris Khan',
      createdDate: '1st February, 2025',
      status: 'Inactive',
      actions: '',
    },
    {
      name: 'Alfonso Baptista',
      role: 'Admin',
      email: 'alfonso@iotility.com',
      userType: 'Workshop User',
      createdBy: 'Haris Khan',
      createdDate: '17th March, 2025',
      status: 'Active',
      actions: '',
    },
    {
      name: 'Gretchen Septimus',
      role: 'Admin',
      email: 'gretchen@iotility.com',
      userType: 'Driver App User',
      createdBy: 'Haris Khan',
      createdDate: '28th May, 2025',
      status: 'Active',
      actions: '',
    },
    {
      name: 'Ashlynn George',
      role: 'Admin',
      email: 'ashlynn@iotility.com',
      userType: 'Driver App User',
      createdBy: 'Haris Khan',
      createdDate: '3rd April, 2025',
      status: 'Inactive',
      actions: '',
    },
  ];
}
