import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/api.dart';
import '../../core/location_service.dart';

class DriverTrackingScreen extends StatefulWidget {
  final String code;
  const DriverTrackingScreen({super.key, required this.code});

  @override
  State<DriverTrackingScreen> createState() => _DriverTrackingScreenState();
}

class _DriverTrackingScreenState extends State<DriverTrackingScreen> {
  final ApiClient _api = ApiClient();

  Map<String, dynamic>? _vehicleData;
  bool _isLoading = true;
  bool _isSharing = false;

  WebSocketChannel? _channel;
  StreamSubscription<Position>? _positionStream;

  @override
  void initState() {
    super.initState();
    _loadVehicle();
  }

  Future<void> _loadVehicle() async {
    try {
      final res = await _api.getVehicleByShareCode(widget.code);
      if (mounted) {
        setState(() {
          _vehicleData = res;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Invalid link or expired fleet')),
        );
      }
    }
  }

  Future<void> _toggleSharing() async {
    if (_isSharing) {
      _stopSharing();
    } else {
      final position = await LocationService.determinePosition(context);
      if (position != null) {
        _startSharing(position);
      }
    }
  }

  void _startSharing(Position initialPosition) {
    if (_vehicleData == null) return;
    final vehicleId = _vehicleData!['vehicle']['id'];

    _channel = WebSocketChannel.connect(Uri.parse(ApiClient.wsUrl));
    _channel!.sink.add(
      jsonEncode({'type': 'shareVehicle', 'vehicleId': vehicleId}),
    );

    // Send the first location immediately so viewers don't have to wait for movement
    _channel!.sink.add(
      jsonEncode({
        'type': 'updateVehicle',
        'data': {
          'latitude': initialPosition.latitude,
          'longitude': initialPosition.longitude,
        },
      }),
    );

    _positionStream =
        Geolocator.getPositionStream(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.bestForNavigation,
            distanceFilter: 5,
          ),
        ).listen((Position position) {
          _channel?.sink.add(
            jsonEncode({
              'type': 'updateVehicle',
              'data': {
                'latitude': position.latitude,
                'longitude': position.longitude,
              },
            }),
          );
        });

    setState(() => _isSharing = true);
  }

  void _stopSharing() {
    _positionStream?.cancel();
    if (_channel != null && _vehicleData != null) {
      _channel!.sink.add(
        jsonEncode({
          'type': 'stopVehicle',
          'vehicleId': _vehicleData!['vehicle']['id'],
        }),
      );
      _channel!.sink.close();
      _channel = null;
    }
    setState(() => _isSharing = false);
  }

  @override
  void dispose() {
    _stopSharing();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_vehicleData == null)
      return const Scaffold(
        body: Center(
          child: Text(
            "Error: Fleet not found",
            style: TextStyle(color: Colors.white),
          ),
        ),
      );

    final vehicle = _vehicleData!['vehicle'];
    final fleetName = _vehicleData!['fleetName'];

    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              vehicle['name'],
              style: const TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              fleetName,
              style: const TextStyle(fontSize: 18, color: Colors.grey),
            ),
            const SizedBox(height: 64),
            InkWell(
              onTap: _toggleSharing,
              borderRadius: BorderRadius.circular(100),
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  color: _isSharing
                      ? Colors.redAccent
                      : const Color(0xFF00B4D8),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: _isSharing
                          ? Colors.redAccent.withOpacity(0.4)
                          : const Color(0xFF00B4D8).withOpacity(0.4),
                      blurRadius: 20,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    _isSharing ? 'Stop\nSharing' : 'Start\nSharing',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 64),
            Text(
              _isSharing
                  ? '📡 Live — your location is being shared'
                  : 'You are not sharing your location',
              style: const TextStyle(color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
