import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../main.dart';
import '../features/share/share_setup_screen.dart';
import '../features/share/sharing_active_screen.dart';
import '../features/fleet/create_fleet_screen.dart';
import '../features/fleet/fleet_admin_screen.dart';
import '../features/driver/driver_tracking_screen.dart';
import '../features/guest/guest_location_screen.dart';
import '../features/guest/guest_fleet_screen.dart';
import '../features/guest/join_guest_fleet_screen.dart';

CustomTransitionPage<void> _fadePage({
  required GoRouterState state,
  required Widget child,
}) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 300),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return FadeTransition(opacity: animation, child: child);
    },
  );
}

final GoRouter appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      pageBuilder: (context, state) => _fadePage(
        state: state,
        child: const MainNavigationScreen(),
      ),
    ),
    GoRoute(
      path: '/join_guest_fleet',
      pageBuilder: (context, state) => _fadePage(
        state: state,
        child: const JoinGuestFleetScreen(),
      ),
    ),
    GoRoute(
      path: '/share_setup',
      pageBuilder: (context, state) => _fadePage(
        state: state,
        child: const ShareSetupScreen(),
      ),
    ),
    GoRoute(
      path: '/sharing_active/:id',
      pageBuilder: (context, state) => _fadePage(
        state: state,
        child: SharingActiveScreen(
          locationId: state.pathParameters['id']!,
          isLive: state.uri.queryParameters['isLive'] == 'true',
        ),
      ),
    ),
    GoRoute(
      path: '/create_fleet',
      pageBuilder: (context, state) => _fadePage(
        state: state,
        child: const CreateFleetScreen(),
      ),
    ),
    GoRoute(
      path: '/fleet_admin/:adminCode',
      pageBuilder: (context, state) => _fadePage(
        state: state,
        child: FleetAdminScreen(adminCode: state.pathParameters['adminCode']!),
      ),
    ),
    GoRoute(
      path: '/vehicle/share/:code',
      pageBuilder: (context, state) => _fadePage(
        state: state,
        child: DriverTrackingScreen(code: state.pathParameters['code']!),
      ),
    ),
    GoRoute(
      path: '/view/:id',
      pageBuilder: (context, state) => _fadePage(
        state: state,
        child: GuestLocationScreen(locationId: state.pathParameters['id']!),
      ),
    ),
    GoRoute(
      path: '/fleet/:id',
      pageBuilder: (context, state) => _fadePage(
        state: state,
        child: GuestFleetScreen(fleetId: state.pathParameters['id']!),
      ),
    ),
  ],
);
