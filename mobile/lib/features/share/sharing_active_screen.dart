import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';


import 'package:geolocator/geolocator.dart';

import '../../core/api.dart';
import '../../core/location_service.dart';
import '../../core/map_config.dart';
import '../../core/reconnecting_socket.dart';
import '../../core/share_manager.dart';

class SharingActiveScreen extends StatefulWidget {
  final String locationId;
  final bool isLive;

  const SharingActiveScreen({
    super.key,
    required this.locationId,
    required this.isLive,
  });

  @override
  State<SharingActiveScreen> createState() => _SharingActiveScreenState();
}

class _SharingActiveScreenState extends State<SharingActiveScreen> {
  final ApiClient _apiClient = ApiClient();
  final ShareManager _shareManager = ShareManager();
  final MapController _mapController = MapController();
  
  LatLng? _currentPosition;
  StreamSubscription<Position>? _locationSub;
  ReconnectingSocket? _socket;
  SocketStatus _socketStatus = SocketStatus.closed;
  Position? _lastPosition;

  String get _shareUrl => '${ApiClient.baseUrl}/view/${widget.locationId}';

  @override
  void initState() {
    super.initState();
    _initLiveTracking();
  }

  Future<void> _initLiveTracking() async {
    final pos = await LocationService.determinePosition(context);
    if (pos != null) {
      if (mounted) {
        setState(() => _currentPosition = LatLng(pos.latitude, pos.longitude));
        _mapController.move(_currentPosition!, 15);
      }
    }

    if (widget.isLive) {
      _connectWebSocket();
      _locationSub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        ),
      ).listen((Position position) {
        if (mounted) {
          setState(() {
            _currentPosition = LatLng(position.latitude, position.longitude);
          });
          _mapController.move(_currentPosition!, 15);
          _sendLocationUpdate(position);
        }
      });
    }
  }

  void _connectWebSocket() {
    _socket = ReconnectingSocket(
      registration: {
        'type': 'share',
        'locationId': widget.locationId,
      },
      onStatusChange: (status) {
        if (mounted) setState(() => _socketStatus = status);
      },
      // The new connection starts with no position, so push the latest one
      // straight away rather than waiting for the next movement.
      onReconnected: () {
        final position = _lastPosition;
        if (position != null) _sendLocationUpdate(position);
      },
    );
    _socket!.connect();
  }

  void _sendLocationUpdate(Position position) {
    _lastPosition = position;
    _socket?.send({
      'type': 'update',
      'data': {
        'latitude': position.latitude,
        'longitude': position.longitude,
      },
    });
  }

  @override
  void dispose() {
    _locationSub?.cancel();
    _socket?.dispose();
    super.dispose();
  }

  Future<void> _stopSharing() async {
    try {
      _locationSub?.cancel();
      _socket?.dispose(farewell: {'type': 'stop'});
      await _apiClient.deleteLocation(widget.locationId);
      await _shareManager.removeShare(widget.locationId);
    } catch (_) {}
    if (mounted) context.pop();
  }

  /// Only meaningful for a live share; a one-off share has no socket.
  bool get _isReconnecting =>
      widget.isLive && _socketStatus != SocketStatus.connected;

  String get _sharingStatusLabel =>
      _isReconnecting ? 'Reconnecting\u2026' : 'Sharing Active';

  Color get _sharingStatusColor =>
      _isReconnecting ? const Color(0xFFF39C12) : const Color(0xFF2ECC71);

  void _shareLinkNative() {
    Share.share('Track my location live on Orbit! $_shareUrl', subject: 'My Location on Orbit');
  }



  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: const LatLng(28.6139, 77.2090),
              initialZoom: 17,
              onMapReady: () {
                if (_currentPosition != null) {
                  _mapController.move(_currentPosition!, 17);
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: MapConfig.tileUrl,
                fallbackUrl: MapConfig.fallbackTileUrl,
                userAgentPackageName: 'com.sharemylocation.app',
                tileProvider: NetworkTileProvider(),
              ),
              if (_currentPosition != null) MarkerLayer(
                markers: [
                  Marker(
                    point: _currentPosition!,
                    child: const Icon(Icons.my_location, color: Color(0xFF00B4D8), size: 30),
                  ),
                ],
              ),
            ],
          ),
          // Back button
          Positioned(
            top: 40,
            left: 16,
            child: CircleAvatar(
              backgroundColor: const Color(0xFF0F0F14),
              child: IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () {
                  HapticFeedback.lightImpact();
                  context.pop();
                },
              ),
            ),
          ),
          // Center on me button
          Positioned(
            top: 40,
            right: 16,
            child: CircleAvatar(
              backgroundColor: const Color(0xFF0F0F14),
              child: IconButton(
                icon: const Icon(Icons.my_location, color: Colors.white),
                onPressed: () {
                  HapticFeedback.lightImpact();
                  if (_currentPosition != null) {
                    _mapController.move(_currentPosition!, 17);
                  }
                },
              ),
            ),
          ),
          // Bottom panel
          Positioned(
            bottom: 32,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF0F0F14),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withOpacity(0.1)),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 10),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              color: _sharingStatusColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _sharingStatusLabel,
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.share, color: Color(0xFF00B4D8)),
                        onPressed: () {
                          HapticFeedback.lightImpact();
                          _shareLinkNative();
                        },
                      ),
                    ],
                  ),

                  // Stop sharing button
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.redAccent,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () {
                        HapticFeedback.lightImpact();
                        _stopSharing();
                      },
                      child: const Text('Stop Sharing', style: TextStyle(fontSize: 16)),
                    ),
                  ),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
