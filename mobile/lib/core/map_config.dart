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

  /// MapTiler Streets, used only when a key is supplied at build time.
  /// With no key this resolves to [fallbackTileUrl], so both slots are the same source.
  static final String tileUrl = _mapTilerKey.isNotEmpty
      ? 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=$_mapTilerKey'
      : fallbackTileUrl;

  /// OpenStreetMap standard tiles. No key, no signup.
  ///
  /// This replaced CARTO Voyager, which was chosen as a keyless fallback but now
  /// stamps "API KEY REQUIRED" across every tile it serves, so it is no longer
  /// usable without an account.
  ///
  /// The OSM Foundation's tile policy only covers light use, so this is a stopgap:
  /// supply MAPTILER_KEY at build time before this reaches any real volume.
  static const String fallbackTileUrl =
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  /// Both providers require this to be visible on the map, not just defined here.
  static final String tileAttribution = _mapTilerKey.isNotEmpty
      ? '© MapTiler © OpenStreetMap contributors'
      : '© OpenStreetMap contributors';

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
