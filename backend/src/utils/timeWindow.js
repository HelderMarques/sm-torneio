/**
 * Retorna a data atual (YYYY-MM-DD) e a hora atual (0-23) no timezone informado.
 * Default: America/Sao_Paulo.
 */
function nowInTimezone(timezone = 'America/Sao_Paulo') {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = parseInt(parts.hour, 10);
  return { date, hour };
}

/**
 * `hour` é 0-23 (sem minutos). Retorna true se hour ∈ [startHour, endHour).
 */
function isWithinWindow(hour, startHour, endHour) {
  return hour >= startHour && hour < endHour;
}

module.exports = { nowInTimezone, isWithinWindow };
