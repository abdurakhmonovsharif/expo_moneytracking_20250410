import { combineReducers } from '@reduxjs/toolkit';
import appReducer from './app-reducer';

export const rootReducer = combineReducers({
  app: appReducer,
  // Add other reducers here if needed
});

export type RootState = ReturnType<typeof rootReducer>;
