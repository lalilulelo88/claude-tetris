---
name: clima
description: Obtiene el clima actual y el pronóstico de la ubicación local del usuario (o de una ciudad que indique). Úsala siempre que el usuario pregunte por el clima, la temperatura, si va a llover, el pronóstico o "qué tiempo hace", aunque no diga la palabra "clima".
---

# Clima local

Usa wttr.in con `curl`. No requiere API key ni dependencias.

## Pasos

1. Si el usuario dio una ciudad, úsala. Si no, deja la ubicación vacía: wttr.in la detecta por IP.
2. Ejecuta (reemplaza `CIUDAD` por el nombre con `+` en vez de espacios, o déjalo vacío):

   ```bash
   curl -s "wttr.in/CIUDAD?lang=es&m&format=j1"
   ```

3. Del JSON toma `nearest_area[0]` (ubicación), `current_condition[0]` (`temp_C`, `FeelsLikeC`, `humidity`, `windspeedKmph`, `weatherDesc[0].value`, que viene en inglés: tradúcelo) y `weather[0..2]` (`mintempC`, `maxtempC`, `hourly[].chanceofrain`).
4. Responde en español, breve: ubicación detectada, condición actual, temperatura (sensación térmica), humedad, viento y pronóstico de hoy y mañana con probabilidad de lluvia.

## Notas

- La ubicación por IP puede ser imprecisa. Indica siempre qué ubicación usaste para que el usuario pueda corregirla.
- Si `curl` falla o no hay red, dilo tal cual. No inventes datos.
