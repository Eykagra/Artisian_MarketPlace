const reservationService = require('../checkout/reservationService');

let intervalRef = null;

function startReservationReaper() {
  if (intervalRef) return;
  intervalRef = setInterval(async () => {
    try {
      const released = await reservationService.releaseExpiredReservations();
      if (released > 0) {
        console.log(`[reservation-reaper] Released ${released} expired reservation line(s)`);
      }
    } catch (err) {
      console.error('[reservation-reaper] Failed to release expired reservations:', err.message || err);
    }
  }, 60 * 1000);
}

module.exports = { startReservationReaper };

