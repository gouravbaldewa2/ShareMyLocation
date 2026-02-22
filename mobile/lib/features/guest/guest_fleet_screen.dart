import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/widgets/pulsing_dot.dart';

class GuestFleetScreen extends StatefulWidget {
  final String fleetId;
  const GuestFleetScreen({super.key, required this.fleetId});

  @override
  State<GuestFleetScreen> createState() => _GuestFleetScreenState();
}

class _GuestFleetScreenState extends State<GuestFleetScreen> {
  final ApiClient _api = ApiClient();
  final MapController _mapController = MapController();
  
  FleetModel? _fleet;
  bool _isLoading = true;
  WebSocketChannel? _channel;

  @override
  void initState() {
    super.initState();
    _loadFleet();
  }

  Future<void> _loadFleet() async {
    try {
      final fleet = await _api.getFleet(widget.fleetId);
      if (mounted) {
        setState(() {
          _fleet = fleet;
          _isLoading = false;
        });
        _connectWebSocket();
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _connectWebSocket() {
    if (_fleet == null) return;
    
    _channel = WebSocketChannel.connect(Uri.parse(ApiClient.wsUrl));
    _channel!.sink.add(jsonEncode({
      'type': 'subscribeFleet',
      'fleetId': _fleet!.id,
    }));

    _channel!.stream.listen((message) {
      final decoded = jsonDecode(message);
      if (decoded['type'] == 'vehicleUpdate') {
         final data = decoded['data'];
         setState(() {
            final idx = _fleet!.vehicles.indexWhere((v) => v.id == data['id']);
            if (idx != -1) {
               final v = _fleet!.vehicles[idx];
               if (data['latitude'] != null) v.latitude = (data['latitude'] as num).toDouble();
               if (data['longitude'] != null) v.longitude = (data['longitude'] as num).toDouble();
               if (data['isLive'] != null) v.isLive = data['isLive'];
               if (data['lastUpdated'] != null) v.lastUpdated = DateTime.parse(data['lastUpdated']).toLocal();
               
               if (_fleet!.vehicles.where((v) => v.isLive).length == 1 && mounted && v.latitude != null && v.longitude != null) {
                  _mapController.move(LatLng(v.latitude!, v.longitude!), 14);
               }
            }
         });
      } else if (decoded['type'] == 'vehicles') {
         final List vehicles = decoded['data'];
         setState(() {
           bool autoPan = false;
           LatLng? panTarget;
           for (var vData in vehicles) {
              final idx = _fleet!.vehicles.indexWhere((v) => v.id == vData['id']);
              if (idx != -1) {
                 final v = _fleet!.vehicles[idx];
                 if (vData['latitude'] != null) v.latitude = (vData['latitude'] as num).toDouble();
                 if (vData['longitude'] != null) v.longitude = (vData['longitude'] as num).toDouble();
                 if (vData['isLive'] != null) v.isLive = vData['isLive'];
                 if (vData['lastUpdated'] != null) v.lastUpdated = DateTime.parse(vData['lastUpdated']).toLocal();
                 
                 if (v.isLive && v.latitude != null && panTarget == null) {
                    panTarget = LatLng(v.latitude!, v.longitude!);
                    autoPan = true;
                 }
              }
           }
           if (autoPan && mounted && panTarget != null) {
              _mapController.move(panTarget, 14);
           }
         });
      } else if (decoded['type'] == 'vehicleStopped') {
         setState(() {
            final id = decoded['data']['vehicleId'];
            final idx = _fleet!.vehicles.indexWhere((v) => v.id == id);
            if (idx != -1) {
               _fleet!.vehicles[idx].isLive = false;
            }
         });
      }
    });
  }

  @override
  void dispose() {
    _channel?.sink.close();
    super.dispose();
  }

  Color _colorFromHex(String hexColor) {
    var hex = hexColor.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final difference = now.difference(time);
    if (difference.inMinutes < 1) return 'Just now';
    if (difference.inHours < 1) return '${difference.inMinutes}m ago';
    if (difference.inDays < 1) return '${difference.inHours}h ago';
    return '${time.month}/${time.day} ${time.hour}:${time.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _getDirections(LatLng pos) async {
    final url = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${pos.latitude},${pos.longitude}');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not launch maps')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_fleet == null) return const Scaffold(body: Center(child: Text("Fleet not found or expired")));

    return Scaffold(
      appBar: AppBar(
        title: Text('${_fleet!.name}'),
        backgroundColor: Colors.transparent,
      ),
      body: Column(
        children: [
          Expanded(
            flex: 6,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.5),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: const LatLng(28.6139, 77.2090),
                    initialZoom: 17,
                    onMapReady: () {
                      final liveVehicles = _fleet!.vehicles.where((v) => v.isLive && v.latitude != null && v.longitude != null);
                      if (liveVehicles.isNotEmpty) {
                        final v = liveVehicles.first;
                        _mapController.move(LatLng(v.latitude!, v.longitude!), 17);
                      }
                    },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.sharemylocation.app',
                    ),
                    MarkerLayer(
                      markers: _fleet!.vehicles
                        .where((v) => v.isLive && v.latitude != null && v.longitude != null)
                        .map((v) {
                        return Marker(
                          point: LatLng(v.latitude!, v.longitude!),
                          width: 60,
                          height: 60,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                               Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                  color: Colors.black.withOpacity(0.6),
                                  child: Text(v.name, style: const TextStyle(color: Colors.white, fontSize: 10)),
                               ),
                               Icon(Icons.location_pin, color: _colorFromHex(v.color), size: 30),
                            ],
                          )
                        );
                      }).toList(),
                    ),
                  ],
                ),
                Positioned(
                  top: 16,
                  right: 16,
                  child: CircleAvatar(
                    backgroundColor: const Color(0xFF0F0F14),
                    child: IconButton(
                      icon: const Icon(Icons.my_location, color: Colors.white),
                      onPressed: () {
                        final liveVehicles = _fleet!.vehicles.where((v) => v.isLive && v.latitude != null && v.longitude != null);
                        if (liveVehicles.isNotEmpty) {
                          final v = liveVehicles.first;
                          _mapController.move(LatLng(v.latitude!, v.longitude!), 17);
                        }
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),),),
          ),
          Expanded(
            flex: 4,
            child: Container(
              color: const Color(0xFF1A1A24),
              child: ListView(
                children: [
                   Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Text('${_fleet!.vehicles.length} Vehicles', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                  ..._fleet!.vehicles.map((v) {
                    final isLive = v.isLive;
                    return ListTile(
                      leading: Icon(Icons.circle, color: isLive ? _colorFromHex(v.color) : Colors.grey),
                      title: Text(v.name, style: const TextStyle(color: Colors.white)),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              if (isLive) ...[
                                const PulsingDot(size: 8),
                                const SizedBox(width: 6),
                              ],
                              Text(isLive ? 'Live' : 'Offline', style: TextStyle(color: isLive ? const Color(0xFF2ECC71) : Colors.grey, fontWeight: FontWeight.w500, letterSpacing: 0.5)),
                            ],
                          ),
                          if (v.lastUpdated != null)
                             Text('Last seen: ${_formatTime(v.lastUpdated!)}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                        ],
                      ),
                      trailing: isLive && v.latitude != null && v.longitude != null
                        ? IconButton(
                            icon: const Icon(Icons.directions, color: Color(0xFF00B4D8)),
                            tooltip: 'Get Directions',
                            onPressed: () => _getDirections(LatLng(v.latitude!, v.longitude!)),
                          )
                        : null,
                    );
                  }).toList(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
