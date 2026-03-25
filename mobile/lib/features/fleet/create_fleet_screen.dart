import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';
import '../../core/api.dart';
import '../../core/fleet_manager.dart';

class CreateFleetScreen extends StatefulWidget {
  const CreateFleetScreen({super.key});

  @override
  State<CreateFleetScreen> createState() => _CreateFleetScreenState();
}

class _CreateFleetScreenState extends State<CreateFleetScreen> {
  final ApiClient _api = ApiClient();
  final FleetManager _fleetManager = FleetManager();
  final TextEditingController _fleetNameController = TextEditingController();
  final TextEditingController _vehicleNameController = TextEditingController();

  List<String> _vehicles = [];
  bool _isCreating = false;

  final GlobalKey _nameFieldKey = GlobalKey();
  final GlobalKey _submitButtonKey = GlobalKey();
  TutorialCoachMark? tutorialCoachMark;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) _checkAndShowCoachmark();
    });
  }

  Future<void> _checkAndShowCoachmark() async {
    final prefs = await SharedPreferences.getInstance();
    final hasSeen = prefs.getBool('has_seen_create_fleet_coachmark') ?? false;
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
        await prefs.setBool('has_seen_create_fleet_coachmark', true);
      },
      onClickTarget: (target) async {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool('has_seen_create_fleet_coachmark', true);
      },
      onSkip: () {
        SharedPreferences.getInstance().then((prefs) {
          prefs.setBool('has_seen_create_fleet_coachmark', true);
        });
        return true;
      },
    )..show(context: context);
  }

  List<TargetFocus> _createTargets() {
    return [
      TargetFocus(
        identify: "nameFieldKey",
        keyTarget: _nameFieldKey,
        shape: ShapeLightFocus.RRect,
        contents: [
          TargetContent(
            align: ContentAlign.bottom,
            builder: (context, controller) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    "Give your fleet a unique name.",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 10),
                  Text(
                    "You'll use this name to identify your vehicles.",
                    style: TextStyle(color: Colors.white70, fontSize: 16),
                  ),
                ],
              );
            },
          ),
        ],
      ),
      TargetFocus(
        identify: "submitButtonKey",
        keyTarget: _submitButtonKey,
        shape: ShapeLightFocus.RRect,
        contents: [
          TargetContent(
            align: ContentAlign.top,
            builder: (context, controller) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: const [
                  Text(
                    "Tap here to create it!",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              );
            },
          ),
        ],
      ),
    ];
  }

  void _addVehicle() {
    final name = _vehicleNameController.text.trim();
    if (name.isNotEmpty) {
      setState(() {
        _vehicles.add(name);
        _vehicleNameController.clear();
      });
    }
  }

  void _removeVehicle(int index) {
    setState(() {
      _vehicles.removeAt(index);
    });
  }

  Future<void> _createFleet() async {
    final name = _fleetNameController.text.trim();
    if (name.isEmpty) return;

    setState(() => _isCreating = true);
    try {
      final fleet = await _api.createFleet(name: name);

      // Save to local storage for My Fleets tab
      await _fleetManager.saveFleet(fleet.id, fleet.adminCode);

      if (mounted) {
        context.pushReplacement('/fleet_admin/${fleet.adminCode}');
      }
    } catch (e) {
      if (mounted) {
        final msg =
            e.toString().contains('SocketException') ||
                e.toString().contains('Failed host lookup')
            ? 'Unable to connect. Please check your internet connection and try again.'
            : 'Something went wrong. Please try again.';
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _isCreating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Fleet'),
        backgroundColor: Colors.transparent,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              key: _nameFieldKey,
              controller: _fleetNameController,
              decoration: const InputDecoration(
                labelText: 'Fleet Name',
                hintText: 'e.g. Resort Buggies',
                filled: true,
                fillColor: Color(0xFF1A1A24),
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                key: _submitButtonKey,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00B4D8),
                  foregroundColor: Colors.white,
                ),
                onPressed: _isCreating
                    ? null
                    : () {
                        HapticFeedback.lightImpact();
                        _createFleet();
                      },
                child: _isCreating
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text(
                        'Create Fleet',
                        style: TextStyle(fontSize: 18),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
