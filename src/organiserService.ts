const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const ADMIN_INTERNAL_KEY = import.meta.env.VITE_ADMIN_INTERNAL_KEY;

export async function createOrganiser(payload) {
  const res = await fetch(`${BACKEND_URL}/organiser/admin/create-organiser`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-fingoh-admin-key": ADMIN_INTERNAL_KEY,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to create organiser");
  return data;
}