export function supportsStorageAccessApi(): boolean {
  return typeof (document as any).requestStorageAccess === "function";
}

export async function hasStorageAccess(): Promise<boolean> {
  const docAny = document as any;
  if (typeof docAny.hasStorageAccess !== "function") return false;
  try {
    return !!(await docAny.hasStorageAccess());
  } catch {
    return false;
  }
}

export async function requestStorageAccess(): Promise<boolean> {
  const docAny = document as any;
  if (typeof docAny.requestStorageAccess !== "function") return false;
  try {
    await docAny.requestStorageAccess();
    return true;
  } catch {
    return false;
  }
}
