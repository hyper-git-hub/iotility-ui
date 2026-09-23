import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DropdownOption } from '../dropdown/dropdown';
import { StatusBadge } from '../status-badge/status-badge';
import { UserMenu } from '../user-menu/user-menu';
@Component({
  selector: 'shared-platform-header',
  imports: [StatusBadge, UserMenu],
  templateUrl: './platform-header.html',
  styleUrl: './platform-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformHeader {
  readonly showLive = input(false);
  readonly liveVehicleCount = input(0);
  readonly liveOffline = input(false);
  readonly userName = input('Haris Khan');
  readonly userInitials = input('HK');
  readonly userRole = input('');
  readonly profileAction = output<DropdownOption>();
}
