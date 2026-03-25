import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';
import 'api.dart';

class FleetManager {
  static const String _key = 'sharemylocation_fleets';
  final ApiClient _apiClient = ApiClient();

  /// Save fleet id & admin code securely
  Future<void> saveFleet(String id, String adminCode) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = prefs.getStringList(_key) ?? [];

    // Convert current map to add new one
    final mapList = jsonList
        .map((e) => jsonDecode(e) as Map<String, dynamic>)
        .toList();

    mapList.add({'id': id, 'adminCode': adminCode});

    await prefs.setStringList(_key, mapList.map((e) => jsonEncode(e)).toList());
  }

  /// Remove fleet from saved preferences
  Future<void> removeFleet(String adminCode) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = prefs.getStringList(_key) ?? [];

    final mapList = jsonList
        .map((e) => jsonDecode(e) as Map<String, dynamic>)
        .toList();
    mapList.removeWhere((e) => e['adminCode'] == adminCode);

    await prefs.setStringList(_key, mapList.map((e) => jsonEncode(e)).toList());
  }

  /// Get actual remote data for all saved fleets
  Future<List<FleetModel>> fetchMyFleets() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = prefs.getStringList(_key) ?? [];

    final mapList = jsonList
        .map((e) => jsonDecode(e) as Map<String, dynamic>)
        .toList();
    List<FleetModel> fleets = [];
    List<String> deletedCodes = [];

    for (var f in mapList) {
      try {
        final fetched = await _apiClient.getFleetByAdminCode(
          f['adminCode'] as String,
        );
        fleets.add(fetched);
      } on NotFoundException {
        // Server confirmed this fleet no longer exists — remove locally
        deletedCodes.add(f['adminCode'] as String);
      } catch (e) {
        // Network error or timeout — keep the fleet, skip for now
      }
    }

    // Clean up only confirmed-deleted fleets from local storage
    if (deletedCodes.isNotEmpty) {
      mapList.removeWhere((e) => deletedCodes.contains(e['adminCode']));
      await prefs.setStringList(
        _key,
        mapList.map((e) => jsonEncode(e)).toList(),
      );
    }

    return fleets;
  }
}
