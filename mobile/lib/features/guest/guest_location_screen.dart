import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:go_router/go_router.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:http/http.dart' as http;
import '../../core/api.dart';
import '../../core/map_config.dart';

class GuestLocationScreen extends StatefulWidget {
  final String locationId;
  const GuestLocationScreen({super.key, required this.locationId});

  @override
  State<GuestLocationScreen> createState() => _GuestLocationScreenState();
}

class _GuestLocationScreenState extends State<GuestLocationScreen> {
  final MapController _mapController = MapController();
  LatLng? _currentPosition;
  WebSocketChannel? _channel;
  bool _isLoading = true;
  String _name = 'Unknown';
  bool _isLive = false;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    try {
      final response = await http.get(Uri.parse('${ApiClient.baseUrl}/api/locations/${widget.locationId}'));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _currentPosition = LatLng(
            double.parse(data['latitude'].toString()), 
            double.parse(data['longitude'].toString())
          );
          _name = data['name'];
          _isLive = data['isLive'] ?? false;
          _isLoading = false;
        });
        
        if (_isLive) {
          _connectWebSocket();
        }
      } else {
         setState(() => _isLoading = false);
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _connectWebSocket() {
    final wsUrl = ApiClient.baseUrl.replaceFirst('http', 'ws');
    _channel = WebSocketChannel.connect(Uri.parse('$wsUrl/ws'));
    
    _channel!.sink.add(jsonEncode({
      'type': 'subscribe',
      'locationId': widget.locationId,
    }));

    _channel!.stream.listen((message) {
      final data = jsonDecode(message);
      if (data['type'] == 'location_update' && data['locationId'] == widget.locationId) {
        if (mounted) {
          setState(() {
            _currentPosition = LatLng(
              double.parse(data['latitude'].toString()), 
              double.parse(data['longitude'].toString())
            );
          });
        }
      }
    }, onError: (e) {
      debugPrint('WebSocket error: $e');
    });
  }

  @override
  void dispose() {
    _channel?.sink.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_currentPosition == null) return const Scaffold(body: Center(child: Text("Location not found")));

    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _currentPosition!,
              initialZoom: 17,
            ),
            children: [
              TileLayer(
                urlTemplate: MapConfig.tileUrl,
                fallbackUrl: MapConfig.fallbackTileUrl,
                userAgentPackageName: 'com.sharemylocation.app',
              ),
              MarkerLayer(
                markers: [
                  Marker(
                    point: _currentPosition!,
                    child: const Icon(Icons.circle, color: Color(0xFF00B4D8)),
                  ),
                ],
              ),
            ],
          ),
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
          Positioned(
            bottom: 32,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF0F0F14),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text(_isLive ? 'Live Location' : 'Last Known Location', style: TextStyle(color: _isLive ? Colors.green : Colors.grey)),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF00B4D8),
                        foregroundColor: Colors.white,
                      ),
                      onPressed: () {
                        HapticFeedback.lightImpact();
                      },
                      child: const Text('Get Directions'),
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
