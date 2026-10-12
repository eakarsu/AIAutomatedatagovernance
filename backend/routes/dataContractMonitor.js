const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    summary: { contracts: 34, schema_breaks: 5, owners_notified: 5, downstream_assets: 82 },
    contracts: [
      { asset: 'passenger_profile', producer: 'CRM', consumer: 'Loyalty', breach: 'nullable email changed', severity: 'high' },
      { asset: 'flight_operations', producer: 'Ops DB', consumer: 'Crew BI', breach: 'enum value added', severity: 'medium' },
      { asset: 'baggage_events', producer: 'Scanner Stream', consumer: 'Claims', breach: 'late delivery SLA', severity: 'medium' },
      { asset: 'booking_transactions', producer: 'Reservations', consumer: 'Revenue BI', breach: 'fare currency code changed', severity: 'medium' },
      { asset: 'loyalty_members', producer: 'Loyalty CRM', consumer: 'Customer Support', breach: 'tier status enum added', severity: 'low' },
      { asset: 'crew_schedules', producer: 'Crew Ops', consumer: 'Duty Compliance', breach: 'shift timestamp nullable', severity: 'high' },
      { asset: 'aircraft_maintenance', producer: 'Maintenance', consumer: 'Safety Reporting', breach: 'work order field renamed', severity: 'high' },
      { asset: 'weather_data', producer: 'Weather Feed', consumer: 'Flight Dispatch', breach: 'observation latency SLA', severity: 'medium' },
      { asset: 'fuel_consumption', producer: 'Flight Ops', consumer: 'Carbon Reporting', breach: 'measurement unit changed', severity: 'high' },
      { asset: 'catering_orders', producer: 'Catering', consumer: 'Cabin Crew', breach: 'meal code enum added', severity: 'low' },
      { asset: 'gate_assignments', producer: 'Airport Ops', consumer: 'Passenger Alerts', breach: 'gate update delay', severity: 'medium' },
      { asset: 'ticket_pricing', producer: 'Fare Management', consumer: 'Booking Engine', breach: 'fare precision changed', severity: 'high' },
      { asset: 'customer_feedback', producer: 'Survey Platform', consumer: 'Experience BI', breach: 'score field nullable', severity: 'low' },
      { asset: 'flight_delays', producer: 'Flight Ops', consumer: 'Operations BI', breach: 'delay reason code added', severity: 'medium' },
      { asset: 'seat_inventory', producer: 'Reservations', consumer: 'Airport Check-in', breach: 'inventory refresh delay', severity: 'high' },
      { asset: 'passenger_checkin', producer: 'Departure Control', consumer: 'Boarding', breach: 'status enum added', severity: 'medium' },
    ],
  });
});

router.post('/validate', (req, res) => {
  const { asset = 'asset', changes = [] } = req.body || {};
  res.json({ asset, changes, compatible: changes.length === 0, recommendation: changes.length ? 'notify consumers and version contract' : 'contract unchanged' });
});

module.exports = router;
