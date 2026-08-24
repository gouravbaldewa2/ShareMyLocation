import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

/// Centralised map configuration so tile URL and defaults
/// can be changed in one place.
class MapConfig {
  MapConfig._();

  /// MapTiler API key, injected at build time via:
  ///   flutter build apk --dart-define=MAPTILER_KEY=your_key_here
  static const String _mapTilerKey =
      String.fromEnvironment('MAPTILER_KEY', defaultValue: '');

  /// MapTiler Streets — colorful, detailed, Google Maps-like aesthetic.
  /// If the 100K loads/month quota is hit, or no key is provided, swap to [fallbackTileUrl].
  static final String tileUrl = _mapTilerKey.isNotEmpty
      ? 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=$_mapTilerKey'
      : fallbackTileUrl;

  /// CARTO Voyager — free, no API key, no quota. Use this if MapTiler quota is exhausted.
  static const String fallbackTileUrl =
      'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  static const String tileAttribution = '© MapTiler © OpenStreetMap contributors';

  /// Fallback centre when device location is unavailable (Mumbai).
  static const LatLng fallbackCenter = LatLng(19.0760, 72.8777);

  /// Try to get the device's current position quickly.
  /// Returns [fallbackCenter] if permissions are denied or unavailable.
  static Future<LatLng> getDeviceLocation() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return fallbackCenter;

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied ||
            permission == LocationPermission.deniedForever) {
          return fallbackCenter;
        }
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
          timeLimit: Duration(seconds: 5),
        ),
      );
      return LatLng(pos.latitude, pos.longitude);
    } catch (_) {
      return fallbackCenter;
    }
  }
}
