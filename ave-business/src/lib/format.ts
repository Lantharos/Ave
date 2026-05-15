export function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "AV";
}

export function formatDate(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function actionLabel(value: string) {
  return value.replace(/\./g, " ").replace(/_/g, " ");
}
