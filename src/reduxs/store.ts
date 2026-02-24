import AsyncStorage from '@react-native-async-storage/async-storage';
import {Action, configureStore, ThunkAction} from '@reduxjs/toolkit';
import {TypedUseSelectorHook, useDispatch, useSelector} from 'react-redux';
import {persistReducer, persistStore} from 'redux-persist';
import {rootReducer} from 'reduxs/reducers/rootReducer';
import thunk from 'redux-thunk';

const config = {
  key: 'money_tracking',
  keyPrefix: '',
  storage: AsyncStorage,
  throttle: 1000,
  migrate: async (state: any) => {
    if (!state || !state.app) {
      return state;
    }
    return {
      ...state,
      app: {
        ...state.app,
        appLoading: false,
        pendingRequests: 0,
      },
    };
  },
  // blacklist: ['app'],
  // whitelist: ['auth'],
};

const persistedReducer = persistReducer(config, rootReducer);
const middlewares = [thunk];

const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(middlewares),
});
let persistor = persistStore(store);

export {persistor};
export default store;

export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
