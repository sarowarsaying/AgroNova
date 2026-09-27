import { useEffect, useRef } from "react";

type GoogleMapProps = {
  latitude: number;
  longitude: number;
};

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (
          element: HTMLElement,
          options: {
            center: {
              lat: number;
              lng: number;
            };
            zoom: number;
          },
        ) => unknown;

        Marker: new (options: {
          position: {
            lat: number;
            lng: number;
          };
          map: unknown;
          title: string;
        }) => unknown;
      };
    };
  }
}

export default function GoogleMap({ latitude, longitude }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey || !mapRef.current) {
      return;
    }

    const initializeMap = () => {
      if (!mapRef.current || !window.google?.maps) {
        return;
      }

      const map = new window.google.maps.Map(mapRef.current, {
        center: {
          lat: latitude,
          lng: longitude,
        },
        zoom: 15,
      });

      new window.google.maps.Marker({
        position: {
          lat: latitude,
          lng: longitude,
        },
        map,
        title: "Selected Location",
      });
    };

    // Google Maps is already loaded
    if (window.google?.maps) {
      initializeMap();
      return;
    }

    // Check whether the script is already being loaded
    const existingScript = document.querySelector(
      'script[data-google-maps="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", initializeMap);
      return () => {
        existingScript.removeEventListener("load", initializeMap);
      };
    }

    // Load Google Maps for the first time
    const script = document.createElement("script");

    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "true";
    script.onload = initializeMap;

    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [latitude, longitude]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: 300,
      }}
    />
  );
}
