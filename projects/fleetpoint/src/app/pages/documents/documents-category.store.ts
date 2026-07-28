import { Injectable, signal } from '@angular/core';
import { DocumentCategory } from './documents.data';

@Injectable({ providedIn:'root' })
export class DocumentsCategoryStore {
  readonly category=signal<'all'|DocumentCategory>('all');
}

