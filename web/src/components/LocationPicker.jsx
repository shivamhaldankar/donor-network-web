// ============================================================
// Pulse Location Picker Component
// Owned by Member C (Web foundation)
// Contract §5:
//   <LocationPicker value={{ latitude, longitude }} onChange={({ latitude, longitude }) => …} />
//   "Use my location" (browser Geolocation) plus manual fields
//   Handles permission denied gracefully
// ============================================================

import React, { useState } from 'react';
import './LocationPicker.css';

export function LocationPicker({ value = { latitude: null, longitude: null }, onChange, disabled = false }) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoNotice, setGeoNotice] = useState(null);

  const handleUseMyLocation = () => {
    setGeoNotice(null);

    if (!('geolocation' in navigator)) {
      setGeoNotice({
        type: 'error',
        text: 'Geolocation is not supported by your browser. Please enter latitude and longitude manually.',
      });
      return;
    }

    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false);
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lng = parseFloat(position.coords.longitude.toFixed(6));
        if (onChange) {
          onChange({ latitude: lat, longitude: lng });
        }
        setGeoNotice({
          type: 'success',
          text: `Location acquired (${lat}, ${lng})`,
        });
      },
      (error) => {
        setGeoLoading(false);
        let errorMsg = 'Could not retrieve your location. Please enter coordinates manually.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission was denied. You can enter latitude and longitude manually below.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location information is unavailable. Please enter coordinates manually.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out. Please retry or enter coordinates manually.';
        }
        setGeoNotice({
          type: 'error',
          text: errorMsg,
        });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleLatChange = (e) => {
    const raw = e.target.value;
    const lat = raw === '' ? null : parseFloat(raw);
    if (onChange) {
      onChange({
        latitude: isNaN(lat) ? null : lat,
        longitude: value?.longitude ?? null,
      });
    }
  };

  const handleLngChange = (e) => {
    const raw = e.target.value;
    const lng = raw === '' ? null : parseFloat(raw);
    if (onChange) {
      onChange({
        latitude: value?.latitude ?? null,
        longitude: isNaN(lng) ? null : lng,
      });
    }
  };

  return (
    <div className="pulse-location-picker">
      <div className="pulse-location-picker__header">
        <label className="form-label" style={{ margin: 0 }}>Coordinates (Optional for matching)</label>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={disabled || geoLoading}
          className="btn btn-secondary btn-sm pulse-location-picker__btn"
        >
          {geoLoading ? (
            <>
              <span className="pulse-spinner pulse-spinner--sm" />
              <span>Locating...</span>
            </>
          ) : (
            <>
              <svg className="pulse-location-picker__icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span>Use my location</span>
            </>
          )}
        </button>
      </div>

      {geoNotice && (
        <div
          className={`pulse-location-notice pulse-location-notice--${geoNotice.type}`}
          role="status"
        >
          {geoNotice.text}
        </div>
      )}

      <div className="pulse-location-picker__fields">
        <div className="pulse-location-picker__field">
          <label htmlFor="latitude-input" className="pulse-location-picker__sublabel">Latitude (-90 to 90)</label>
          <input
            id="latitude-input"
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            disabled={disabled}
            placeholder="e.g. 18.520400"
            value={value?.latitude ?? ''}
            onChange={handleLatChange}
            className="input-control"
          />
        </div>
        <div className="pulse-location-picker__field">
          <label htmlFor="longitude-input" className="pulse-location-picker__sublabel">Longitude (-180 to 180)</label>
          <input
            id="longitude-input"
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            disabled={disabled}
            placeholder="e.g. 73.856700"
            value={value?.longitude ?? ''}
            onChange={handleLngChange}
            className="input-control"
          />
        </div>
      </div>
      <p className="form-helper" style={{ marginTop: 4 }}>
        Coordinates enable proximity-based donor matching. If omitted, matching falls back to your city.
      </p>
    </div>
  );
}

export default LocationPicker;
