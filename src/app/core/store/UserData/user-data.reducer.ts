// src/app/store/user-data.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { IUser } from '../../../models';
import * as UserDataActions from './user-data.actions';

export interface UserDataState {
  currentUser: IUser | null;
}

export const initialState: UserDataState = {
  currentUser: null,
};

export const userDataReducer = createReducer(
  initialState,
  on(UserDataActions.setCurrentUser, (state, { user }) => ({
    ...state,
    currentUser: user,
  })),
  on(UserDataActions.clearCurrentUser, (state) => ({
    ...state,
    currentUser: null,
  }))
);
