const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo de petición inválido" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Falta la variable de entorno GEMINI_API_KEY en Netlify" }, { status: 500 });
  }

  const { home, away, competition, goles_esperados, mercados } = body;
  if (!home || !away || !mercados) {
    return Response.json({ error: "Faltan datos del partido para analizar" }, { status: 400 });
  }

  const prompt = `Eres un analista de fútbol. Te paso las probabilidades calculadas por un modelo estadístico (Dixon-Coles) para un partido. Escribe un análisis breve en español (máximo 120 palabras) que:
- Comente si el favoritismo del modelo tiene sentido futbolístico (en base a lo que sabes de estos equipos/selecciones: nivel, plantilla, contexto reciente)
- Señale cualquier matiz o riesgo que el modelo NO puede ver (lesiones relevantes que conozcas, motivación, contexto del torneo/jornada)
- Si no conoces bien a algún equipo, dilo en vez de inventar
- No repitas los números tal cual, el usuario ya los ve en pantalla

Partido: ${home} vs ${away} (${competition || ""})
Goles esperados del modelo: ${home} ${goles_esperados?.local}, ${away} ${goles_esperados?.visitante}
1X2 del modelo: ${JSON.stringify(mercados["1X2"])}
Marcador más probable: ${mercados["Marcador exacto (top 10)"]?.[0]?.marcador}

Responde solo con el análisis, sin preámbulos.`;

  try {
    const text = await callGemini(prompt, apiKey);
    return Response.json({ analysis: text || "No se generó análisis." });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
};

async function callGemini(prompt, apiKey, attempt = 1) {
  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    const isOverloaded = resp.status === 503 || resp.status === 429;
    if (isOverloaded && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1200 * attempt));
      return callGemini(prompt, apiKey, attempt + 1);
    }
    throw new Error(`Gemini API HTTP ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n").trim();
}

export const config = {
  path: "/api/analyze",
};
