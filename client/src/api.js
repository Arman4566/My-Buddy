async function request(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const studyTopic = (topic, source) =>
  request("/api/study", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, source }),
  });

export const identifyImage = (blob) => {
  const form = new FormData();
  form.append("image", blob, "photo.jpg");
  return request("/api/identify", { method: "POST", body: form });
};

export const getHistory = () => request("/api/history");
