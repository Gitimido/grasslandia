// src/app/store/user-data.actions.ts
import { createAction, props } from '@ngrx/store';
import { IUser } from '../../../models';

export const setCurrentUser = createAction(
  '[User Data] Set Current User',
  props<{ user: IUser }>()
);

export const clearCurrentUser = createAction('[User Data] Clear Current User');
