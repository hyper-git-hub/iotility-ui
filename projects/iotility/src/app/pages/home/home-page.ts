import { Component } from '@angular/core';
import { LoadingService } from '../../shared/services/loading.service';

interface IotilityModule {
  id: string;
  name: string;
  tagline: string;
  initials: string;
  rating: number;
  available: boolean;
  accentClass: string;
}

interface OnboardingStep {
  id: number;
  title: string;
  content: string;
  hasAction?: boolean;
}

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  protected activeModuleId = 'fleetpoint';
  protected expandedStep: number | null = 1;
  protected guideCollapsed = false;

  protected readonly modules: IotilityModule[] = [
    {
      id: 'fleetpoint',
      name: 'Fleetpoint',
      tagline: 'Seamless fleet operations',
      initials: 'FP',
      rating: 4.9,
      available: true,
      accentClass: 'bg-brand-600',
    },
    {
      id: 'assetrack',
      name: 'Assetrack',
      tagline: 'Manage your assets smoothly',
      initials: 'AT',
      rating: 4.8,
      available: false,
      accentClass: 'bg-info',
    },
    {
      id: 'sustainex',
      name: 'Sustainex',
      tagline: 'Contribute to a sustainable earth',
      initials: 'SU',
      rating: 4.7,
      available: false,
      accentClass: 'bg-success',
    },
    {
      id: 'twinscape',
      name: 'Twinscape',
      tagline: 'Smarter solution for smarter buildings',
      initials: 'TS',
      rating: 4.8,
      available: false,
      accentClass: 'bg-warning',
    },
    {
      id: 'wasterack',
      name: 'Wasterack',
      tagline: 'Manage your waste, without mess',
      initials: 'WR',
      rating: 4.6,
      available: false,
      accentClass: 'bg-brand-400',
    },
  ];

  protected readonly onboardingSteps: OnboardingStep[] = [
    {
      id: 1,
      title: 'Step 1: You are on the Free Tier of IoTility FleetPoint',
      content:
        'You have full access to the FleetPoint demo environment. Explore live tracking, driver management, route planning and reporting with up to 5 demo vehicles.',
    },
    {
      id: 2,
      title: 'Step 2: Get your IoT devices installed',
      content:
        'Install your GPS trackers and IoT sensors on your vehicles. Choose self-installation or book a certified IoTility engineer.',
      hasAction: true,
    },
    {
      id: 3,
      title: 'Step 3: Configure your preferences',
      content:
        'Set your timezone, units, alert thresholds, geofence zones, and notification preferences.',
    },
    {
      id: 4,
      title: 'Step 4: Add vehicles',
      content:
        'Register your fleet, including vehicle types and fuel types, then assign vehicles to depots or groups.',
    },
    {
      id: 5,
      title: 'Step 5: Add drivers',
      content:
        'Create driver profiles, set working hours and licence categories, and link drivers to vehicles.',
    },
    {
      id: 6,
      title: 'Step 6: Set up your dashboard',
      content: 'Choose dashboard widgets, configure KPI tiles, and set your reporting schedule.',
    },
  ];

  constructor(private readonly loading: LoadingService) {}

  protected get activeModule(): IotilityModule {
    return this.modules.find((module) => module.id === this.activeModuleId) ?? this.modules[0];
  }

  protected selectModule(moduleId: string): void {
    this.activeModuleId = moduleId;
  }

  protected toggleStep(stepId: number): void {
    this.expandedStep = this.expandedStep === stepId ? null : stepId;
  }

  protected toggleGuide(): void {
    this.guideCollapsed = !this.guideCollapsed;
  }

  protected openFleetPoint(): void {
    this.loading.navigate(
      '/fleetpoint/dashboard',
      {
        label: 'IoTility',
        title: 'Loading FleetPoint',
        message: 'Preparing your fleet command center...',
        initials: 'FP',
      },
      2000,
    );
  }
}
