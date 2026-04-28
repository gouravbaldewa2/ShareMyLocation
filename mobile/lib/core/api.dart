import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';

class NotFoundException implements Exception {
  final String message;
  NotFoundException(this.message);
  @override
  String toString() => message;
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment config injected at build time via --dart-define=FLAVOR=dev|prod
// Production:  flutter build apk --flavor prod --dart-define=FLAVOR=prod
// Dev APK:     flutter build apk --flavor dev  --dart-define=FLAVOR=dev
// ─────────────────────────────────────────────────────────────────────────────
const _flavor = String.fromEnvironment('FLAVOR', defaultValue: 'prod');

const _baseUrls = {
  'prod': 'https://diplomatic-learning-production-f128.up.railway.app',
  'dev':  'https://sharemylocation-staging.up.railway.app',
};

const _wsUrls = {
  'prod': 'wss://diplomatic-learning-production-f128.up.railway.app/ws',
  'dev':  'wss://sharemylocation-staging.up.railway.app/ws',
};

class ApiClient {
  static final String baseUrl = _baseUrls[_flavor]!;
  static final String wsUrl   = _wsUrls[_flavor]!;

  Future<LocationModel> createLocation({
    required double lat,
    required double lng,
    required bool isLive,
    required int expiresInMinutes,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/locations'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'latitude': lat,
        'longitude': lng,
        'isLive': isLive,
        'expiresInMinutes': expiresInMinutes,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return LocationModel.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to create location: ${response.statusCode}');
    }
  }

  Future<LocationModel> getLocation(String id) async {
    final response = await http.get(Uri.parse('$baseUrl/api/locations/$id'));

    if (response.statusCode == 200) {
      return LocationModel.fromJson(jsonDecode(response.body));
    } else if (response.statusCode == 404) {
      throw NotFoundException('Location not found');
    } else {
      throw Exception('Failed to fetch location');
    }
  }

  Future<void> deleteLocation(String id) async {
    final response = await http.delete(Uri.parse('$baseUrl/api/locations/$id'));
    if (response.statusCode != 200 && response.statusCode != 204) {
      throw Exception('Failed to delete location');
    }
  }

  Future<FleetModel> createFleet({
    required String name,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/fleets'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'name': name,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return FleetModel.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to create fleet');
    }
  }

  Future<FleetModel> getFleet(String id) async {
    final response = await http.get(Uri.parse('$baseUrl/api/fleets/$id'));

    if (response.statusCode == 200) {
      return FleetModel.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to fetch fleet');
    }
  }

  Future<FleetModel> getFleetByAdminCode(String adminCode) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/fleets/admin/$adminCode'),
    );

    if (response.statusCode == 200) {
      return FleetModel.fromJson(jsonDecode(response.body));
    } else if (response.statusCode == 404) {
      throw NotFoundException('Fleet not found');
    } else {
      throw Exception('Failed to fetch fleet as admin');
    }
  }

  Future<void> deleteFleet(String adminCode) async {
    final response = await http.delete(Uri.parse('$baseUrl/api/fleets/admin/$adminCode'));

    if (response.statusCode != 200 && response.statusCode != 204) {
      throw Exception('Failed to delete fleet');
    }
  }

  Future<VehicleModel> addVehicleToFleet({
    required String fleetId,
    required String name,
    required String color,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/vehicles'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'fleetId': fleetId,
        'name': name,
        'color': color,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return VehicleModel.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to add vehicle');
    }
  }

  Future<void> deleteVehicle(String id) async {
    final response = await http.delete(Uri.parse('$baseUrl/api/vehicles/$id'));
    if (response.statusCode != 200 && response.statusCode != 204) {
      throw Exception('Failed to delete vehicle');
    }
  }

  Future<Map<String, dynamic>> getVehicleByShareCode(String shareCode) async {
    final response = await http.get(Uri.parse('$baseUrl/api/vehicles/share/$shareCode'));
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to fetch vehicle details via share code');
    }
  }
}
