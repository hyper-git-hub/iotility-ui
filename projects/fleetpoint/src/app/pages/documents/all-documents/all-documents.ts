import { Component, OnInit } from '@angular/core';
import { DocumentsCategoryStore } from '../documents-category.store';
@Component({selector:'app-all-documents',template:'',styles:[':host{display:none}']})
export class AllDocuments implements OnInit{constructor(private readonly store:DocumentsCategoryStore){}ngOnInit():void{this.store.category.set('all');}}
