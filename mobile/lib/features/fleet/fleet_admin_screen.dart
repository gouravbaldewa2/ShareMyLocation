import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/widgets/pulsing_dot.dart';

class FleetAdminScreen extends StatefulWidget {
  final String adminCode;
  const FleetAdminScreen({super.key, required this.adminCode});

  @override
  State<FleetAdminScreen> createState() => _FleetAdminScreenState();
}

class _FleetAdminScreenState extends State<FleetAdminScreen> {
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
      final fleet = await _api.getFleetByAdminCode(widget.adminCode);
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
    _channel!.sink.add(
      jsonEncode({'type': 'subscribeFleet', 'fleetId': _fleet!.id}),
    );

    _channel!.stream.listen((message) {
      final decoded = jsonDecode(message);
      if (decoded['type'] == 'vehicleUpdate') {
        final data = decoded['data'];
        setState(() {
          final idx = _fleet!.vehicles.indexWhere((v) => v.id == data['id']);
          if (idx != -1) {
            final v = _fleet!.vehicles[idx];
            if (data['latitude'] != null)
              v.latitude = (data['latitude'] as num).toDouble();
            if (data['longitude'] != null)
              v.longitude = (data['longitude'] as num).toDouble();
            if (data['isLive'] != null) v.isLive = data['isLive'];
            if (data['lastUpdated'] != null)
              v.lastUpdated = DateTime.parse(data['lastUpdated']).toLocal();

            // Auto-pan to updated vehicle
            if (mounted && v.latitude != null && v.longitude != null) {
              _mapController.move(LatLng(v.latitude!, v.longitude!), 14);
            }
          }
        });
      } else if (decoded['type'] == 'vehicles') {
        // Batch initial sync
        final List vehicles = decoded['data'];
        setState(() {
          bool autoPan = false;
          LatLng? panTarget;
          for (var vData in vehicles) {
            final idx = _fleet!.vehicles.indexWhere((v) => v.id == vData['id']);
            if (idx != -1) {
              final v = _fleet!.vehicles[idx];
              if (vData['latitude'] != null)
                v.latitude = (vData['latitude'] as num).toDouble();
              if (vData['longitude'] != null)
                v.longitude = (vData['longitude'] as num).toDouble();
              if (vData['isLive'] != null) v.isLive = vData['isLive'];
              if (vData['lastUpdated'] != null)
                v.lastUpdated = DateTime.parse(vData['lastUpdated']).toLocal();

              if (v.isLive && v.latitude != null && panTarget == null) {
                panTarget = LatLng(v.latitude!, v.longitude!);
                autoPan = true;
              }
            } else {
              try {
                // Add missing vehicle that we did not have locally
                _fleet!.vehicles.add(
                  VehicleModel.fromJson(vData as Map<String, dynamic>),
                );
              } catch (e) {
                // Ignore missing or malformed vehicle
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

  void _shareGuestLink() {
    if (_fleet == null) return;
    final url = '${ApiClient.baseUrl}/fleet/${_fleet!.id}';
    Share.share('Track our vehicles live: $url', subject: 'Fleet Tracking');
  }

  void _shareDriverLink(VehicleModel vehicle) {
    if (_fleet == null) return;
    final url = '${ApiClient.baseUrl}/vehicle/share/${vehicle.driverLink}';
    Share.share(
      'Start sharing location for ${vehicle.name}: $url',
      subject: 'Driver Link',
    );
  }

  Future<void> _deleteVehicle(VehicleModel vehicle) async {
    try {
      await _api.deleteVehicle(vehicle.id);
      _loadFleet(); // Reload to reflect changes
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to delete')));
    }
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

  void _showAddVehicleModal() {
    final nameController = TextEditingController();
    String selectedColor = '#00B4D8';

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F0F14),
      isScrollControlled: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom,
                left: 24,
                right: 24,
                top: 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Add New Vehicle',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.grey),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(
                      labelText: 'Vehicle Name',
                      hintText: 'e.g., Delivery Van 3',
                      filled: true,
                      fillColor: Color(0xFF1A1A24),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Pin Color',
                    style: TextStyle(color: Colors.white),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children:
                        [
                          '#00B4D8',
                          '#2ECC71',
                          '#E74C3C',
                          '#F1C40F',
                          '#9B59B6',
                        ].map((color) {
                          return GestureDetector(
                            onTap: () =>
                                setModalState(() => selectedColor = color),
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: _colorFromHex(color),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: selectedColor == color
                                      ? Colors.white
                                      : Colors.transparent,
                                  width: 3,
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    height: 56,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF00B4D8),
                        foregroundColor: Colors.white,
                      ),
                      onPressed: () async {
                        HapticFeedback.lightImpact();
                        if (nameController.text.isEmpty) return;
                        Navigator.pop(ctx);
                        try {
                          final newVehicle = await _api.addVehicleToFleet(
                            fleetId: _fleet!.id,
                            name: nameController.text.trim(),
                            color: selectedColor,
                          );
                          // Directly append the new vehicle to local state
                          // without re-establishing the WebSocket connection
                          if (mounted) {
                            setState(() {
                              _fleet!.vehicles.add(newVehicle);
                            });
                          }
                        } catch (e) {
                          if (mounted)
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Failed to add')),
                            );
                        }
                      },
                      child: const Text(
                        'Add Vehicle',
                        style: TextStyle(fontSize: 18),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ), // ends Column
            ); // ends Padding
          },
        ); // ends StatefulBuilder
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_fleet == null)
      return const Scaffold(body: Center(child: Text("Fleet not found")));

    return Scaffold(
      appBar: AppBar(
        title: Text('Fleet: ${_fleet!.name}'),
        backgroundColor: Colors.transparent,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadFleet,
            tooltip: 'Refresh',
          ),
          IconButton(
            icon: const Icon(Icons.share),
            onPressed: () {
              HapticFeedback.lightImpact();
              _shareGuestLink();
            },
            tooltip: 'Share Guest Map',
          ),
        ],
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
                            final liveVehicles = _fleet!.vehicles.where(
                              (v) =>
                                  v.isLive &&
                                  v.latitude != null &&
                                  v.longitude != null,
                            );
                            if (liveVehicles.isNotEmpty) {
                              final v = liveVehicles.first;
                              _mapController.move(
                                LatLng(v.latitude!, v.longitude!),
                                17,
                              );
                            }
                          },
                        ),
                        children: [
                          TileLayer(
                            urlTemplate:
                                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'com.sharemylocation.app',
                          ),
                          MarkerLayer(
                            markers: _fleet!.vehicles
                                .where(
                                  (v) =>
                                      v.isLive &&
                                      v.latitude != null &&
                                      v.longitude != null,
                                )
                                .map((v) {
                                  return Marker(
                                    point: LatLng(v.latitude!, v.longitude!),
                                    width: 60,
                                    height: 60,
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 4,
                                            vertical: 2,
                                          ),
                                          color: Colors.black.withOpacity(0.6),
                                          child: Text(
                                            v.name,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 10,
                                            ),
                                          ),
                                        ),
                                        Icon(
                                          Icons.location_pin,
                                          color: _colorFromHex(v.color),
                                          size: 30,
                                        ),
                                      ],
                                    ),
                                  );
                                })
                                .toList(),
                          ),
                        ],
                      ),
                      Positioned(
                        top: 16,
                        right: 16,
                        child: CircleAvatar(
                          backgroundColor: const Color(0xFF0F0F14),
                          child: IconButton(
                            icon: const Icon(
                              Icons.my_location,
                              color: Colors.white,
                            ),
                            onPressed: () {
                              final liveVehicles = _fleet!.vehicles.where(
                                (v) =>
                                    v.isLive &&
                                    v.latitude != null &&
                                    v.longitude != null,
                              );
                              if (liveVehicles.isNotEmpty) {
                                final v = liveVehicles.first;
                                _mapController.move(
                                  LatLng(v.latitude!, v.longitude!),
                                  17,
                                );
                              }
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            flex: 4,
            child: Container(
              color: const Color(0xFF1A1A24),
              child: ListView(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${_fleet!.vehicles.length} Vehicles',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        TextButton.icon(
                          onPressed: () {
                            HapticFeedback.lightImpact();
                            _showAddVehicleModal();
                          },
                          icon: const Icon(Icons.add, color: Color(0xFF00B4D8)),
                          label: const Text(
                            'Add Vehicle',
                            style: TextStyle(color: Color(0xFF00B4D8)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  ..._fleet!.vehicles.map((v) {
                    final isLive = v.isLive;
                    return ListTile(
                      leading: Icon(
                        Icons.circle,
                        color: isLive ? _colorFromHex(v.color) : Colors.grey,
                      ),
                      title: Text(
                        v.name,
                        style: const TextStyle(color: Colors.white),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              if (isLive) ...[
                                const PulsingDot(size: 8),
                                const SizedBox(width: 6),
                              ],
                              Text(
                                isLive ? 'Live' : 'Offline',
                                style: TextStyle(
                                  color: isLive
                                      ? const Color(0xFF2ECC71)
                                      : Colors.grey,
                                  fontWeight: FontWeight.w500,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                          if (v.lastUpdated != null)
                            Text(
                              'Last seen: ${_formatTime(v.lastUpdated!)}',
                              style: const TextStyle(
                                color: Colors.white54,
                                fontSize: 12,
                              ),
                            ),
                        ],
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(
                              Icons.delete,
                              color: Colors.redAccent,
                            ),
                            tooltip: 'Delete Vehicle',
                            onPressed: () {
                              HapticFeedback.lightImpact();
                              _deleteVehicle(v);
                            },
                          ),
                          IconButton(
                            icon: const Icon(
                              Icons.share,
                              color: Color(0xFF00B4D8),
                            ),
                            tooltip: 'Copy Driver Link',
                            onPressed: () {
                              HapticFeedback.lightImpact();
                              _shareDriverLink(v);
                            },
                          ),
                        ],
                      ),
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
