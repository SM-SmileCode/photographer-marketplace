import React from "react";

function ExploreFilters({ filters, onFilterChange, onReset }) {
  return (
    <div className="mb-6 grid gap-4 rounded-xl border border-[var(--line)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <input
        value={filters.city}
        onChange={(e) => onFilterChange("city", e.target.value)}
        placeholder="City"
        className="form-input border-[var(--line)]"
      />

      <input
        value={filters.state}
        onChange={(e) => onFilterChange("state", e.target.value)}
        placeholder="State"
        className="form-input border-[var(--line)]"
      />

      <select
        value={filters.eventType}
        onChange={(e) => onFilterChange("eventType", e.target.value)}
        placeholder="Event Type"
        className="form-input border-[var(--line)]"
      >
        <option value="">All Event Types</option>
        <option value="wedding">Wedding</option>
        <option value="birthday">Birthday</option>
        <option value="prewedding">Pre-Wedding</option>
        <option value="corporate">Corporate</option>
        <option value="babyshoot">Baby Shoot</option>
        <option value="product">Product</option>
        <option value="travel">Travel</option>
        <option value="other">Other</option>
      </select>

      <select
        value={filters.service}
        onChange={(e) => onFilterChange("service", e.target.value)}
        placeholder="Service"
        className="form-input border-[var(--line)]"
      >
        <option value="">All Services</option>
        <option value="photography">Photography</option>
        <option value="videography">Videography</option>
        <option value="drone">Drone</option>
        <option value="album">Album</option>
        <option value="reels">Reels</option>
      </select>

      <input
        type="number"
        value={filters.minPrice}
        onChange={(e) => onFilterChange("minPrice", e.target.value)}
        placeholder="Minimum Price"
        className="form-input border-[var(--line)]"
      />

      <input
        type="number"
        value={filters.maxPrice}
        onChange={(e) => onFilterChange("maxPrice", e.target.value)}
        placeholder="Maximum Price"
        className="form-input border-[var(--line)]"
      />

      <select
        value={filters.sort}
        onChange={(e) => onFilterChange("sort", e.target.value)}
        className="form-input border-[var(--line)]"
      >
        <option value="newest">Newest</option>
        <option value="price_asc">Price low to high</option>
        <option value="price_desc">Price high to low</option>
        <option value="rating_desc">Top Rated</option>
      </select>

      <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)]">
        <input
          type="checkbox"
          checked={Boolean(filters.instantOnly)}
          onChange={(e) => onFilterChange("instantOnly", e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        Instant booking only
      </label>

      <button
        type="button"
        onClick={onReset}
        className="btn-small border border-[var(--line)] text-[var(--text)]"
      >
        Reset
      </button>
    </div>
  );
}

export default ExploreFilters;
