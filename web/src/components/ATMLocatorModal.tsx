import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { findATMLocations, type ATMLocation } from "../api/client";
import { deduplicateATMs } from "../utils/dedup";

const defaultIcon = L.divIcon({
  className: "",
  html: `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="#4F46E5"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -36],
});

const selectedIcon = L.divIcon({
  className: "",
  html: `<svg width="34" height="44" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="#DC2626"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 44],
  popupAnchor: [0, -44],
});

const FEATURE_OPTIONS = [
  { id: "OPEN_24_HOURS", label: "Open 24 Hours", icon: "24h" },
  { id: "DEPOSIT_AVAILABLE", label: "Deposits", icon: "dep" },
  { id: "ACCESSIBLE", label: "Accessible", icon: "acc" },
] as const;

const RADIUS_OPTIONS = [5, 10, 25, 50];

interface Props {
  cardId: string;
  onClose: () => void;
}

export function ATMLocatorModal({ cardId, onClose }: Props) {
  const [locations, setLocations] = useState<ATMLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [radius, setRadius] = useState(10);
  const [center, setCenter] = useState<[number, number]>([37.7749, -122.4194]);
  const [geoResolved, setGeoResolved] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const fetchATMs = useCallback(
    (lat: string, lng: string, r: number) => {
      setLoading(true);
      setError(null);
      setSelectedIndex(null);
      findATMLocations(cardId, lat, lng, r)
        .then((data) => {
          setLocations(data);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    },
    [cardId],
  );

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setCenter(c);
          setGeoResolved(true);
          fetchATMs(String(c[0]), String(c[1]), radius);
        },
        () => {
          setGeoResolved(true);
          fetchATMs(String(center[0]), String(center[1]), radius);
        },
        { timeout: 5000 },
      );
    } else {
      setGeoResolved(true);
      fetchATMs(String(center[0]), String(center[1]), radius);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRadiusChange(r: number) {
    setRadius(r);
    fetchATMs(String(center[0]), String(center[1]), r);
  }

  function toggleFilter(f: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  const filtered = activeFilters.size === 0
    ? locations
    : locations.filter((atm) =>
        Array.from(activeFilters).every((f) => atm.features?.includes(f)),
      );

  const deduped = deduplicateATMs(filtered);

  // Initialize map
  useEffect(() => {
    if (!geoResolved || !mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center, 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [geoResolved]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers with deduped locations
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const markers = deduped
      .map((atm, i) => {
        if (!atm.coordinates) return null;
        const lat = Number(atm.coordinates.latitude);
        const lng = Number(atm.coordinates.longitude);
        const marker = L.marker([lat, lng], {
          icon: selectedIndex === i ? selectedIcon : defaultIcon,
        }).addTo(map);

        const popupHtml = `<div class="text-xs">
          <p class="font-semibold">${atm.name || "ATM"}</p>
          ${atm.address ? `<p class="text-gray-500 mt-0.5">${atm.address.streetAddress}, ${atm.address.locality}</p>` : ""}
          ${atm.distance ? `<p class="text-indigo-600 font-medium mt-1">${atm.distance.length.toFixed(1)} mi away</p>` : ""}
          <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener noreferrer" class="inline-block mt-1 text-indigo-600 hover:text-indigo-800 font-medium">Directions</a>
        </div>`;
        marker.bindPopup(popupHtml);
        marker.on("click", () => selectATM(i));
        return marker;
      })
      .filter((m): m is L.Marker => m !== null);

    markersRef.current = markers;

    // Fit bounds
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => m.getLatLng()));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [deduped, selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectATM(index: number) {
    setSelectedIndex(index === selectedIndex ? null : index);
    // Scroll the list item into view
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-atm-index="${index}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900/60 backdrop-blur-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white border-b border-gray-200 px-5 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white text-xs font-bold">
            ATM
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Find Surcharge-Free ATMs</h2>
            <p className="text-xs text-gray-500">MoneyPass network</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Radius selector */}
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-0.5">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => handleRadiusChange(r)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  radius === r
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {r} mi
              </button>
            ))}
          </div>
          {/* Filter chips */}
          <div className="hidden sm:flex items-center gap-1.5">
            {FEATURE_OPTIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => toggleFilter(f.id)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
                  activeFilters.has(f.id)
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Close */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile filter row */}
      <div className="sm:hidden flex items-center gap-1.5 px-4 py-2 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
        {FEATURE_OPTIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => toggleFilter(f.id)}
            className={`flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
              activeFilters.has(f.id)
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "bg-white border-gray-200 text-gray-500"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Main content: map + sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainerRef} className="w-full h-full" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[1000]">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Searching for ATMs...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-[1000]">
              <div className="text-center px-6">
                <p className="text-sm text-red-600 font-medium">{error}</p>
                <button
                  onClick={() => fetchATMs(String(center[0]), String(center[1]), radius)}
                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
          {/* Attribution */}
          <div className="absolute bottom-1 left-1 text-[10px] text-gray-400 z-[1000]">
            Map data &copy; OpenStreetMap &middot; CartoDB
          </div>
        </div>

        {/* Sidebar list */}
        <div className="w-80 lg:w-96 bg-white border-l border-gray-200 flex flex-col shrink-0 hidden md:flex">
          {/* Count */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <p className="text-xs font-medium text-gray-500">
              {loading
                ? "Searching..."
                : `${deduped.length} ATM${deduped.length !== 1 ? "s" : ""} found`}
              {activeFilters.size > 0 && !loading && (
                <span className="text-gray-400"> (filtered from {locations.length})</span>
              )}
            </p>
          </div>

          {/* List */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {deduped.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <p className="text-sm text-gray-500">No ATMs match your filters.</p>
                {activeFilters.size > 0 && (
                  <button
                    onClick={() => setActiveFilters(new Set())}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
            {deduped.map((atm, i) => (
              <button
                key={i}
                data-atm-index={i}
                onClick={() => selectATM(i)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                  selectedIndex === i
                    ? "bg-indigo-50 border-l-2 border-l-indigo-500"
                    : "hover:bg-gray-50 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${selectedIndex === i ? "text-indigo-900" : "text-gray-900"}`}>
                      {atm.name || "ATM"}
                    </p>
                    {atm.address && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {atm.address.streetAddress}, {atm.address.locality}
                      </p>
                    )}
                    {atm.features && atm.features.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {atm.features.map((f) => (
                          <span
                            key={f}
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              f === "OPEN_24_HOURS"
                                ? "bg-emerald-50 text-emerald-700"
                                : f === "DEPOSIT_AVAILABLE"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-purple-50 text-purple-700"
                            }`}
                          >
                            {f === "OPEN_24_HOURS" ? "24h" : f === "DEPOSIT_AVAILABLE" ? "Deposits" : "Accessible"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {atm.distance && (
                      <span className="text-xs font-semibold text-gray-400 tabular-nums">
                        {atm.distance.length < 1
                          ? `${(atm.distance.length * 5280).toFixed(0)} ft`
                          : `${atm.distance.length.toFixed(1)} mi`}
                      </span>
                    )}
                    {atm.coordinates && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${atm.coordinates.latitude},${atm.coordinates.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Directions
                      </a>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
