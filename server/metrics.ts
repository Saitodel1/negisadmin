type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

function zonedDateTimeToUtc(parts: ZonedDateParts, timeZone: string) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let candidate = target;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getZonedParts(new Date(candidate), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    candidate += target - actualAsUtc;
  }

  return new Date(candidate);
}

export function getTimeZoneDayRange(now: Date, timeZone: string) {
  const current = getZonedParts(now, timeZone);
  const nextDay = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
  const start = zonedDateTimeToUtc({ ...current, hour: 0, minute: 0, second: 0 }, timeZone);
  const end = zonedDateTimeToUtc({
    year: nextDay.getUTCFullYear(),
    month: nextDay.getUTCMonth() + 1,
    day: nextDay.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0
  }, timeZone);

  return {
    start,
    end,
    localDate: `${current.year}-${String(current.month).padStart(2, '0')}-${String(current.day).padStart(2, '0')}`
  };
}

