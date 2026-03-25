import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';
import 'api.dart';

class ShareManager {
  static const String _key = 'sharemylocation_shares';
  final ApiClient _apiClient = ApiClient();

  /// Save a share's location ID and metadata locally
  Future<void> saveShare({
    required String locationId,
    required bool isLive,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = prefs.getStringList(_key) ?? [];

    final mapList = jsonList
        .map((e) => jsonDecode(e) as Map<String, dynamic>)
        .toList();

    // Avoid duplicates
    mapList.removeWhere((e) => e['locationId'] == locationId);

    mapList.add({
      'locationId': locationId,
      'isLive': isLive,
      'createdAt': DateTime.now().toIso8601String(),
    });

    await prefs.setStringList(
        _key, mapList.map((e) => jsonEncode(e)).toList());
  }

  /// Remove a share from local storage
  Future<void> removeShare(String locationId) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = prefs.getStringList(_key) ?? [];

    final mapList = jsonList
        .map((e) => jsonDecode(e) as Map<String, dynamic>)
        .toList();
    mapList.removeWhere((e) => e['locationId'] == locationId);

    await prefs.setStringList(
        _key, mapList.map((e) => jsonEncode(e)).toList());
  }

  /// Fetch all saved shares, verifying each still exists on the server
  Future<List<LocationModel>> fetchMyShares() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = prefs.getStringList(_key) ?? [];

    final mapList = jsonList
        .map((e) => jsonDecode(e) as Map<String, dynamic>)
        .toList();

    List<LocationModel> shares = [];
    List<String> deletedIds = [];

    for (var s in mapList) {
      try {
        final location =
            await _apiClient.getLocation(s['locationId'] as String);
        shares.add(location);
      } on NotFoundException {
        // Server confirmed this location no longer exists — remove locally
        deletedIds.add(s['locationId'] as String);
      } catch (e) {
        // Network error or timeout — keep the share, skip for now
      }
    }

    // Clean up only confirmed-deleted shares from local storage
    if (deletedIds.isNotEmpty) {
      mapList.removeWhere(
          (e) => deletedIds.contains(e['locationId']));
      await prefs.setStringList(
          _key, mapList.map((e) => jsonEncode(e)).toList());
    }

    return shares;
  }
}
