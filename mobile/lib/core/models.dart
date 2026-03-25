class LocationModel {
  final String id;
  final double latitude;
  final double longitude;
  final DateTime createdAt;
  final DateTime expiresAt;
  final bool isLive;

  LocationModel({
    required this.id,
    required this.latitude,
    required this.longitude,
    required this.createdAt,
    required this.expiresAt,
    required this.isLive,
  });

  factory LocationModel.fromJson(Map<String, dynamic> json) {
    return LocationModel(
      id: json['id'] as String,
      latitude: json['latitude'] as double,
      longitude: json['longitude'] as double,
      createdAt: DateTime.parse(json['createdAt'] as String),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      isLive: json['isLive'] as bool,
    );
  }
}

class VehicleModel {
  final String id;
  final String fleetId;
  final String name;
  final String color;
  final String? locationId;
  final String driverLink;
  LocationModel? location;
  double? latitude;
  double? longitude;
  bool isLive;
  DateTime? lastUpdated;

  VehicleModel({
    required this.id,
    required this.fleetId,
    required this.name,
    required this.color,
    this.locationId,
    required this.driverLink,
    this.location,
    this.latitude,
    this.longitude,
    this.isLive = false,
    this.lastUpdated,
  });

  factory VehicleModel.fromJson(Map<String, dynamic> json) {
    return VehicleModel(
      id: json['id'] as String,
      fleetId: json['fleetId'] as String,
      name: json['name'] as String,
      color: json['color'] as String,
      locationId: json['locationId'] as String?,
      driverLink: json['shareCode'] as String,
      latitude: json['latitude'] != null ? (json['latitude'] as num).toDouble() : null,
      longitude: json['longitude'] != null ? (json['longitude'] as num).toDouble() : null,
      isLive: json['isLive'] ?? false,
      lastUpdated: json['lastUpdated'] != null ? DateTime.parse(json['lastUpdated'] as String).toLocal() : null,
    );
  }
}

class FleetModel {
  final String id;
  final String name;
  final String adminCode;
  final DateTime createdAt;
  final DateTime expiresAt;
  final List<VehicleModel> vehicles;

  FleetModel({
    required this.id,
    required this.name,
    required this.adminCode,
    required this.createdAt,
    required this.expiresAt,
    required this.vehicles,
  });

  factory FleetModel.fromJson(Map<String, dynamic> json) {
    return FleetModel(
      id: json['id'] as String,
      name: json['name'] as String,
      adminCode: json['adminCode'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      vehicles: (json['vehicles'] as List?)
              ?.map((v) => VehicleModel.fromJson(v as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
