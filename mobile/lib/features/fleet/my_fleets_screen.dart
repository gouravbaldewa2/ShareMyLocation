import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/fleet_manager.dart';
import '../../core/models.dart';
import '../../core/api.dart';

class MyFleetsScreen extends StatefulWidget {
  final bool showAppBar;
  const MyFleetsScreen({super.key, this.showAppBar = false});

  @override
  State<MyFleetsScreen> createState() => MyFleetsScreenState();
}

class MyFleetsScreenState extends State<MyFleetsScreen> {
  final FleetManager _fleetManager = FleetManager();
  List<FleetModel> _fleets = [];
  bool _isLoading = true;

  final GlobalKey _fabKey = GlobalKey();
  TutorialCoachMark? tutorialCoachMark;

  @override
  void initState() {
    super.initState();
    loadFleets().then((_) {
      if (_fleets.isEmpty && mounted) {
        Future.delayed(const Duration(milliseconds: 800), () {
          if (mounted) _checkAndShowCoachmark();
        });
      }
    });
  }

  Future<void> loadFleets() async {
    setState(() => _isLoading = true);
    final fleets = await _fleetManager.fetchMyFleets();
    if (mounted) {
      setState(() {
        _fleets = fleets;
        _isLoading = false;
      });
    }
  }

  Future<void> _checkAndShowCoachmark() async {
    final prefs = await SharedPreferences.getInstance();
    final hasSeen =
        prefs.getBool('has_seen_fleet_dashboard_coachmark') ?? false;
    if (!hasSeen && mounted) {
      _showCoachmark();
    }
  }

  void _showCoachmark() {
    tutorialCoachMark = TutorialCoachMark(
      targets: _createTargets(),
      colorShadow: const Color(0xFF0F0F14),
      textSkip: "SKIP",
      paddingFocus: 10,
      opacityShadow: 0.8,
      onFinish: () async {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool('has_seen_fleet_dashboard_coachmark', true);
      },
      onClickTarget: (target) async {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool('has_seen_fleet_dashboard_coachmark', true);
      },
      onSkip: () {
        SharedPreferences.getInstance().then((prefs) {
          prefs.setBool('has_seen_fleet_dashboard_coachmark', true);
        });
        return true;
      },
    )..show(context: context);
  }

  List<TargetFocus> _createTargets() {
    return [
      TargetFocus(
        identify: "fabKey",
        keyTarget: _fabKey,
        shape: ShapeLightFocus.Circle,
        contents: [
          TargetContent(
            align: ContentAlign.top,
            builder: (context, controller) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: const [
                  Text(
                    "Start here! Tap to create your very first fleet.",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                    textAlign: TextAlign.right,
                  ),
                ],
              );
            },
          ),
        ],
      ),
    ];
  }

  Future<void> _confirmDeleteFleet(FleetModel fleet) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A24),
        title: const Text(
          'Delete Fleet?',
          style: TextStyle(color: Colors.white),
        ),
        content: Text(
          'Are you sure you want to permanently delete "${fleet.name}"?',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      setState(() => _isLoading = true);
      try {
        await ApiClient().deleteFleet(fleet.adminCode);
        await _fleetManager.removeFleet(fleet.adminCode);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Error deleting fleet')));
        }
      }
      loadFleets();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.showAppBar
          ? AppBar(
              title: const Text('My Fleets'),
              backgroundColor: Colors.transparent,
              actions: [
                IconButton(
                  icon: const Icon(Icons.refresh),
                  onPressed: () => loadFleets(),
                ),
              ],
            )
          : null,
      body: RefreshIndicator(
        onRefresh: loadFleets,
        color: const Color(0xFF00B4D8),
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF00B4D8)),
              )
            : _fleets.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 300),
                  Center(
                    child: Text(
                      "No Fleets Found. Tap '+' to create one.",
                      style: TextStyle(color: Colors.grey),
                    ),
                  ),
                ],
              )
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _fleets.length,
                itemBuilder: (context, index) {
                  final fleet = _fleets[index];
                  return Card(
                    color: const Color(0xFF1A1A24),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      onTap: () async {
                        HapticFeedback.lightImpact();
                        await context.push('/fleet_admin/${fleet.adminCode}');
                        loadFleets();
                      },
                      title: Text(
                        fleet.name,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text('${fleet.vehicles.length} Vehicles'),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete, color: Colors.grey),
                        onPressed: () {
                          HapticFeedback.lightImpact();
                          _confirmDeleteFleet(fleet);
                        },
                      ),
                    ),
                  );
                },
              ),
      ),
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 100),
        child: FloatingActionButton(
          key: _fabKey,
          backgroundColor: const Color(0xFF00B4D8),
          onPressed: () async {
            HapticFeedback.lightImpact();
            await context.push('/create_fleet');
            loadFleets();
          },
          child: const Icon(Icons.add, color: Colors.white),
        ),
      ),
    );
  }
}
