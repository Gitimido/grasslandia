// src/app/core/store/index.ts
// Export specific named exports to avoid ambiguity

// UserData exports
export { setCurrentUser, clearCurrentUser } from './UserData/user-data.actions';
export { userDataReducer } from './UserData/user-data.reducer';
export { selectCurrentUser } from './UserData/user-data.selectors';

// Auth exports
export {
  loginSuccess,
  logout,
  setAuthLoading,
  setAuthError,
} from './Auth/auth.actions';
export { authReducer } from './Auth/auth.reducer';
export {
  selectUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
} from './Auth/auth.selectors';
