async function request(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const post = (url, body) =>
  request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const studyTopic = (topic, source, context = "") => post("/api/study", { topic, source, context });
export const moreStudy = (payload) => post("/api/more", payload);

export const identifyImage = (blob) => {
  const form = new FormData();
  form.append("image", blob, "photo.jpg");
  return request("/api/identify", { method: "POST", body: form });
};
