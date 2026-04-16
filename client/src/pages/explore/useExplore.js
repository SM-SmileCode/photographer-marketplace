import { useEffect, useState } from "react";
import { fetchPhotographers } from "../../services/exploreService";

const INITIAL_FILTERS = {
  city: "",
  state: "",
  eventType: "",
  service: "",
  minPrice: "",
  maxPrice: "",
  sort: "newest",
  instantOnly: false,
};

function useExplore() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    totalPages: 1,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");

        const queryFilters = {
          ...filters,
          page,
          limit,
        };

        if (!queryFilters.instantOnly) {
          delete queryFilters.instantOnly;
        }

        const result = await fetchPhotographers(queryFilters);
        if (!alive) return;

        setItems(result.items);
        setPagination(result.pagination);
      } catch (error) {
        if (!alive) return;
        setError(error.message || "Failed to load photographers");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [filters, page, limit]);

  const setFilter = (name, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setPage(1);
    setFilters(INITIAL_FILTERS);
  };

  return {
    items,
    loading,
    error,
    filters,
    setFilter,
    resetFilters,
    page,
    setPage,
    pagination,
  };
}

export default useExplore;
