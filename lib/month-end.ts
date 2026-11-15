const TIME_ZONE = "Asia/Amman";

export function monthEnd(now: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const midnight = Date.UTC(year, month, 1);
  const offset = new Intl.DateTimeFormat("en", {
    timeZone: TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(midnight))
    .find((p) => p.type === "timeZoneName")!.value;
  const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offsetMinutes = match
    ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1)
    : 0;
  return {
    deadline: midnight - offsetMinutes * 60000,
    label: new Intl.DateTimeFormat("ar-JO", {
      timeZone: TIME_ZONE,
      month: "long",
    }).format(now),
  };
}

export function timeRemaining(deadline: number, now: number) {
  const total = Math.max(0, Math.ceil((deadline - now) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
    finished: total === 0,
  };
}
