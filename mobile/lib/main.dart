import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:play_install_referrer/play_install_referrer.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/router.dart';
import 'core/share_manager.dart';
import 'core/fleet_manager.dart';
import 'core/models.dart';
import 'core/widgets/glass_card.dart';
import 'features/share/my_shares_screen.dart';
import 'features/fleet/my_fleets_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final hasSeenOnboarding = prefs.getBool('has_seen_onboarding') ?? false;
  runApp(OrbitApp(hasSeenOnboarding: hasSeenOnboarding));
}

class OrbitApp extends StatelessWidget {
  final bool hasSeenOnboarding;
  const OrbitApp({super.key, required this.hasSeenOnboarding});

  @override
  Widget build(BuildContext context) {
    final router = createAppRouter(hasSeenOnboarding);
    return MaterialApp.router(
      title: 'Orbit',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF00B4D8),
          surface: Color(0xFF0F0F14),
        ),
        scaffoldBackgroundColor: const Color(0xFF0F0F14),
        useMaterial3: true,
        fontFamily: 'Inter',
      ),
      routerConfig: router,
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  // Keys for child tabs so we can trigger reloads
  final GlobalKey<MySharesScreenState> _sharesKey = GlobalKey();
  final GlobalKey<MyFleetsScreenState> _fleetsKey = GlobalKey();

  // Dashboard stats
  int _activeSharesCount = 0;
  String _nearestExpiry = '--';
  int _activeFleetsCount = 0;
  int _liveVehiclesCount = 0;
  bool _statsLoading = true;

  @override
  void initState() {
    super.initState();
    _checkInstallReferrer();
    _loadDashboardStats();
  }

  Future<void> _loadDashboardStats() async {
    setState(() => _statsLoading = true);
    try {
      final shares = await ShareManager().fetchMyShares();
      final fleets = await FleetManager().fetchMyFleets();

      int liveVehicles = 0;
      for (final f in fleets) {
        liveVehicles += f.vehicles.where((v) => v.isLive).length;
      }

      String nearest = '--';
      if (shares.isNotEmpty) {
        shares.sort((a, b) => a.expiresAt.compareTo(b.expiresAt));
        final remaining = shares.first.expiresAt.difference(DateTime.now());
        if (remaining.isNegative) {
          nearest = 'Expired';
        } else if (remaining.inMinutes < 60) {
          nearest = '${remaining.inMinutes}m';
        } else if (remaining.inHours < 24) {
          nearest = '${remaining.inHours}h';
        } else {
          nearest = '${remaining.inDays}d';
        }
      }

      if (mounted) {
        setState(() {
          _activeSharesCount = shares.length;
          _nearestExpiry = nearest;
          _activeFleetsCount = fleets.length;
          _liveVehiclesCount = liveVehicles;
          _statsLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _statsLoading = false);
    }
  }

  void _onTabChanged(int index) {
    HapticFeedback.lightImpact();
    setState(() => _currentIndex = index);

    // Refresh data when switching tabs
    if (index == 0) {
      _loadDashboardStats();
    } else if (index == 1) {
      _sharesKey.currentState?.loadShares();
    } else if (index == 2) {
      _fleetsKey.currentState?.loadFleets();
    }
  }

  Future<void> _checkInstallReferrer() async {
    try {
      if (Theme.of(context).platform == TargetPlatform.android) {
        final prefs = await SharedPreferences.getInstance();
        if (prefs.getBool('has_checked_referrer') ?? false) {
          return;
        }

        final referrerDetails = await PlayInstallReferrer.installReferrer;
        final referrer = referrerDetails.installReferrer;
        
        if (referrer != null && referrer.isNotEmpty) {
           final decodedReferrer = Uri.decodeFull(referrer);
           final uri = Uri.parse('http://dummy.com?$decodedReferrer');
           
           if (uri.queryParameters.containsKey('fleetCode')) {
              final code = uri.queryParameters['fleetCode'];
              if (code != null && code.isNotEmpty && mounted) {
                 context.push('/guest_fleet/$code');
              }
           } else if (uri.queryParameters.containsKey('shareCode')) {
              final code = uri.queryParameters['shareCode'];
              if (code != null && code.isNotEmpty && mounted) {
                 context.push('/vehicle/share/$code');
              }
           }
        }
        await prefs.setBool('has_checked_referrer', true);
      }
    } catch (e) {
      debugPrint('Error checking install referrer: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                'assets/icon.png',
                width: 32,
                height: 32,
              ),
            ),
            const SizedBox(width: 10),
            Text(
              _currentIndex == 0 ? 'Orbit' : _currentIndex == 1 ? 'My Orbits' : 'My Fleets',
              style: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: 1.2),
            ),
          ],
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: const [],
      ),
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: [
              RefreshIndicator(
                onRefresh: _loadDashboardStats,
                color: const Color(0xFF00B4D8),
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: SizedBox(
                    height: MediaQuery.of(context).size.height - 200,
                    child: _buildDashboard(),
                  ),
                ),
              ),
              MySharesScreen(key: _sharesKey),
              MyFleetsScreen(key: _fleetsKey),
            ],
          ),
          // Custom floating nav bar
          Positioned(
            bottom: 24 + MediaQuery.of(context).padding.bottom,
            left: 24,
            right: 24,
            child: Container(
              height: 64,
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A24).withOpacity(0.92),
                borderRadius: BorderRadius.circular(32),
                border: Border.all(
                  color: Colors.white.withOpacity(0.1),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.4),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                  BoxShadow(
                    color: const Color(0xFF00B4D8).withOpacity(0.08),
                    blurRadius: 30,
                    spreadRadius: -5,
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildNavItem(
                    icon: Icons.home_outlined,
                    activeIcon: Icons.home,
                    label: 'Home',
                    index: 0,
                  ),
                  _buildNavItem(
                    icon: Icons.share_location_outlined,
                    activeIcon: Icons.share_location,
                    label: 'My Orbit',
                    index: 1,
                  ),
                  _buildNavItem(
                    icon: Icons.directions_car_outlined,
                    activeIcon: Icons.directions_car,
                    label: 'Fleet',
                    index: 2,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required IconData activeIcon,
    required String label,
    required int index,
  }) {
    final isSelected = _currentIndex == index;
    return GestureDetector(
      onTap: () => _onTabChanged(index),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF00B4D8).withOpacity(0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Row(
          children: [
            Icon(
              isSelected ? activeIcon : icon,
              color: isSelected
                  ? const Color(0xFF00B4D8)
                  : Colors.grey.shade500,
              size: 22,
            ),
            if (isSelected) ...[
              const SizedBox(width: 6),
              Text(
                label,
                style: const TextStyle(
                  color: Color(0xFF00B4D8),
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDashboard() {
    if (!_statsLoading && _activeSharesCount == 0 && _activeFleetsCount == 0) {
      return _buildEmptyHomeView();
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Stats Row
          Row(
            children: [
              Expanded(child: _buildStatCard(
                title: 'Active Shares',
                value: _statsLoading ? '...' : '$_activeSharesCount',
                detail: _activeSharesCount > 0 ? 'Next expiry: $_nearestExpiry' : 'None active',
                icon: Icons.share_location,
                color: const Color(0xFF00B4D8),
                onTap: () => _onTabChanged(1),
              )),
              const SizedBox(width: 16),
              Expanded(child: _buildStatCard(
                title: 'Active Fleets',
                value: _statsLoading ? '...' : '$_activeFleetsCount',
                detail: '$_liveVehiclesCount live vehicles',
                icon: Icons.directions_car,
                color: const Color(0xFF9B59B6),
                onTap: () => _onTabChanged(2),
              )),
            ],
          ),
          const SizedBox(height: 24),
          // Quick Actions
          Row(
            children: [
              Expanded(child: _buildQuickAction(
                label: 'Share Now',
                icon: Icons.add_location_alt,
                color: const Color(0xFF00B4D8),
                onTap: () async {
                  HapticFeedback.lightImpact();
                  await context.push('/share_setup');
                  _loadDashboardStats();
                  _sharesKey.currentState?.loadShares();
                },
              )),
              const SizedBox(width: 16),
              Expanded(child: _buildQuickAction(
                label: 'Create Fleet',
                icon: Icons.add_circle_outline,
                color: const Color(0xFF9B59B6),
                onTap: () async {
                  HapticFeedback.lightImpact();
                  await context.push('/create_fleet');
                  _loadDashboardStats();
                  _fleetsKey.currentState?.loadFleets();
                },
              )),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyHomeView() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Hero Banner
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF00B4D8), Color(0xFF9B59B6)],
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00B4D8).withOpacity(0.3),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Stay connected.\nStay in control.',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    height: 1.2,
                    letterSpacing: -0.5,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 12),
                Text(
                  'Share your location instantly or track your entire fleet.',
                  style: TextStyle(
                    fontSize: 15,
                    height: 1.4,
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Card 1: Share Location
          _buildHeroActionCard(
            title: 'Share Your Location',
            icon: Icons.location_on,
            color: const Color(0xFF00B4D8),
            buttonText: 'Share Now \u2192',
            onTap: () async {
              HapticFeedback.lightImpact();
              await context.push('/share_setup');
              _loadDashboardStats();
              _sharesKey.currentState?.loadShares();
            },
          ),
          const SizedBox(height: 12),
          // Card 2: Fleet Command Center
          _buildHeroActionCard(
            title: 'Fleet Command Center',
            icon: Icons.directions_bus,
            color: const Color(0xFF9B59B6),
            buttonText: 'Create Fleet \u2192',
            onTap: () async {
              HapticFeedback.lightImpact();
              await context.push('/create_fleet');
              _loadDashboardStats();
              _fleetsKey.currentState?.loadFleets();
            },
          ),
        ],
      ),
    );
  }

  Widget _buildHeroActionCard({
    required String title,
    required IconData icon,
    required Color color,
    required String buttonText,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A24),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: Colors.white.withOpacity(0.05),
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(icon, color: color, size: 22),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Align(
                  alignment: Alignment.centerRight,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      buttonText,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required String title,
    required String value,
    required String detail,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GlassCard(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 20, color: color),
              ),
              const Spacer(),
              Text(
                value,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            detail,
            style: TextStyle(
              fontSize: 12,
              color: Colors.white.withOpacity(0.5),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickAction({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
