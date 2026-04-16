import { useCallback, useEffect, useReducer } from "react";

const initialState = {
  items: [],
  loading: false,
  error: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: "" };
    case "LOAD_SUCCESS":
      return { ...state, loading: false, items: action.payload };
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

export function useListData(fetchFn, dependencies = []) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = useCallback(
    async (params = {}) => {
      dispatch({ type: "LOAD_START" });
      try {
        const data = await fetchFn(params);
        dispatch({ type: "LOAD_SUCCESS", payload: data?.items || [] });
        return true;
      } catch (error) {
        dispatch({
          type: "LOAD_ERROR",
          payload: error.message || "Failed to load data.",
        });
        return false;
      }
    },
    [fetchFn],
  );

  const reload = useCallback(
    async (params = {}) => {
      try {
        const data = await fetchFn(params);
        dispatch({ type: "LOAD_SUCCESS", payload: data?.items || [] });
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload: error.message || "Failed to refresh data.",
        });
      }
    },
    [fetchFn],
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      if (alive) await load();
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return { ...state, load, reload };
}
