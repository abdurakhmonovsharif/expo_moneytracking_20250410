import { beginAppRequest, endAppRequest } from "reduxs/reducers/app-reducer";
import store from "reduxs/store";

export const runWithAppRequest = async <T>(
  request: () => Promise<T>
): Promise<T> => {
  store.dispatch(beginAppRequest());
  try {
    return await request();
  } finally {
    store.dispatch(endAppRequest());
  }
};
