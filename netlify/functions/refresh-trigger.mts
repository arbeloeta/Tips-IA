// Se ejecuta sola cada 6 horas y simplemente dispara la función en segundo
// plano que hace el trabajo pesado (descargar datos + reentrenar el modelo).
// Así no estamos limitados por el límite de 30s de las funciones programadas.

export default async (req) => {
  const { next_run } = await req.json();
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";

  try {
    await fetch(`${siteUrl}/.netlify/functions/refresh-models-background`, {
      method: "POST",
    });
    console.log("Actualización disparada. Próxima ejecución programada:", next_run);
  } catch (e) {
    console.error("No se pudo disparar la actualización:", e.message);
  }
};

export const config = {
  schedule: "0 */6 * * *",
};
