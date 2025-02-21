// webapp.gs
// Definisci CONFIG prima di qualsiasi funzione che la usa
const CONFIG = {
  TEMPERATURE_URL: 'http://93.57.89.4:8081/temporeale/api/stations/rt-data',
  HUMIDITY_URL: 'http://93.57.89.4:8081/temporeale/api/stations/103/storic-data/q',
  REALTIME_URL: 'http://93.57.89.4:8081/temporeale/api/stations/rt-data',
  STATION_CODE: 39, // Codice stazione di Casamassima
  RETRY_ATTEMPTS: 3, // Numero di tentativi in caso di errore di rete
  RETRY_DELAY_MS: 1000, // Intervallo tra i tentativi in millisecondi
  TEMPERATURE_SENSOR: { rete: 1, sensore: 5, misura: 5 },
  HUMIDITY_SENSOR: { rete: 1, sensore: 6, misura: 5 },
  //Mappa dei nomi dei campi meteo (senza spazi finali)
  WEATHER_FIELDS: {
    pioggiaTotaleOggi: "Pioggia Totale Oggi",
    intensitaPioggia: "Intensità Pioggia",
    temperatura: "Temperatura Aria",
    direzioneVento: "Direzione Vento",
    velocitaVento: "Velocità Vento"
  }
};

// Funzione di utilità per i tentativi
function withRetry(fn, maxAttempts = CONFIG.RETRY_ATTEMPTS, delay = CONFIG.RETRY_DELAY_MS) {
  Logger.log(`withRetry chiamata con: fn = ${typeof fn}, maxAttempts = ${maxAttempts}, delay = ${delay}`); // AGGIUNTO

  if (typeof fn !== 'function') { // AGGIUNTO: controllo se fn è una funzione
    Logger.log("ERRORE: fn non è una funzione!"); // AGGIUNTO
    throw new TypeError("fn deve essere una funzione!"); // AGGIUNTO: Rilancia l'errore in modo più esplicito
  }

  for (let i = 0; i < maxAttempts; i++) {
    try {
      return fn(); // Prova ad eseguire la funzione
    } catch (error) {
      Logger.log(`Tentativo ${i + 1} fallito: ${error}`);
      if (i === maxAttempts - 1) throw error; // Rilancia l'errore se è l'ultimo tentativo
      Utilities.sleep(delay); // Attendi prima del prossimo tentativo
    }
  }
}


// Funzione generica per recuperare dati storici
function getLastHistoricalData(url, sensorConfig, valoreKey) {
  Logger.log(`getLastHistoricalData chiamata con: url = ${url}, sensorConfig = ${JSON.stringify(sensorConfig)}, valoreKey = ${valoreKey}`); // AGGIUNTO

  const payload = {
    rete: sensorConfig.rete,
    sensore: sensorConfig.sensore,
    misura: sensorConfig.misura,
    giornaliero: false,
    period: "hours",
    periodh: 24
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true,
    'headers': {
      'Accept': 'application/json',
    }
  };

  try {
    const response = withRetry(() => { // Usa withRetry con funzione anonima
      return UrlFetchApp.fetch(url, options);
    });
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      try {
        const data = JSON.parse(response.getContentText());
          if (data && Array.isArray(data) && data.length > 0) {
            const lastDataPoint = data[data.length - 1];

            if (lastDataPoint && lastDataPoint[valoreKey] !== undefined && lastDataPoint[valoreKey] !== null) {
              const valore = lastDataPoint[valoreKey];
                if (typeof valore === 'number') { // Esempio: verifica che sia un numero
                  Logger.log(`Ultimo dato storico: ${valore}`);
                  return valore;
                } else {
                  Logger.log(`Valore non numerico ricevuto: ${valore}`);
                  return "Dato non valido";
                }
            } else {
              Logger.log("Valore non disponibile.");
              return "Nessun dato disponibile";
            }
          } else {
            Logger.log("Nessun dato storico trovato.");
            return "Nessun dato storico disponibile";
          }
      } catch (parseError) {
        Logger.log(`Errore durante il parsing JSON: ${parseError}`);
        return "Errore nel parsing dei dati";
      }
    } else {
      Logger.log(`Errore HTTP: Codice di stato ${statusCode}`);
      return `Errore HTTP ${statusCode}`;
    }
  } catch (error) {
    Logger.log(`Errore generale: ${error}`);
    return "Errore durante l'esecuzione della funzione";
  }
}

// Funzione per recuperare l'ultimo dato cronologico di temperatura
function getCasamassimaLastHistoricalTemperature() {
  Logger.log("getCasamassimaLastHistoricalTemperature chiamata"); // AGGIUNTO
  return getLastHistoricalData(CONFIG.TEMPERATURE_URL, CONFIG.TEMPERATURE_SENSOR, "Valore");
}

// Funzione per recuperare l'ultimo dato cronologico di umidità
function getCasamassimaLastHistoricalHumidity() {
  Logger.log("getCasamassimaLastHistoricalHumidity chiamata"); // AGGIUNTO
  return getLastHistoricalData(CONFIG.HUMIDITY_URL, CONFIG.HUMIDITY_SENSOR, "Valore");
}

// Funzione per recuperare i dati meteo di Casamassima (TEMPO REALE)
function getCasamassimaWeatherData() {
  Logger.log("getCasamassimaWeatherData chiamata"); // AGGIUNTO

  try {
    const response = withRetry(() => { // Usa withRetry con funzione anonima
      return UrlFetchApp.fetch(CONFIG.REALTIME_URL, {
        muteHttpExceptions: true,
        headers: {
          'Accept': 'application/json',
        },
      });
    });

    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      const data = JSON.parse(response.getContentText());

      // Trova la stazione di Casamassima
      const casamassimaData = data.find(station => station.codice === CONFIG.STATION_CODE);

      if (casamassimaData) {
        // Inizializza l'oggetto con i dati
        const weatherData = {
          "Ultimo Aggiornamento": casamassimaData.lastUpdateTime || "N/A", //Gestione del valore mancante
          "Temperatura Aria": null,
          "Intensità Pioggia": null,
          "Pioggia Totale Oggi": null,
          "Direzione Vento (gradi)": null,
          "Velocità Vento": null,
          "Umidità Relativa": null //Inizializza anche l'umidità
        };

        // Estrai i dati dall'array "analog" usando la configurazione
        for (const reading of casamassimaData.analog) {
          const descr = reading.descr.trim(); //Rimuovi gli spazi e confronta
          if (descr === CONFIG.WEATHER_FIELDS.pioggiaTotaleOggi) {
            weatherData["Pioggia Totale Oggi"] = reading.valore || null;
          } else if (descr === CONFIG.WEATHER_FIELDS.intensitaPioggia) {
            weatherData["Intensità Pioggia"] = reading.valore || null;
          } else if (descr === CONFIG.WEATHER_FIELDS.temperatura) {
            weatherData["Temperatura Aria"] = reading.valore || null;
          } else if (descr === CONFIG.WEATHER_FIELDS.direzioneVento) {
            weatherData["Direzione Vento (gradi)"] = reading.valore || null;
          } else if (descr === CONFIG.WEATHER_FIELDS.velocitaVento) {
            weatherData["Velocità Vento"] = reading.valore || null;
          }
        }

        // Ottieni e aggiungi l'umidità
        const umiditaRelativa = getCasamassimaLastHistoricalHumidity();
        weatherData["Umidità Relativa"] = umiditaRelativa;

        return weatherData;
      } else {
        Logger.log("Stazione di Casamassima non trovata.");
        return null;
      }
    } else {
      Logger.log(`Errore: Codice di stato ${statusCode}`);
      return null;
    }
  } catch (error) {
    Logger.log(`Errore: ${error}`);
    return null;
  }
}

// airQualityScraper.gs (INCORPORATO QUI PER SEMPLICITÀ)
function scrapeWeatherData() {
  const url = 'https://weather.com/it-IT/forecast/air-quality/l/b3810e11362feaa7f180dcbe01b6611919a3e4d4f25b04744d1140581977fe4b';

  try {
    const response = UrlFetchApp.fetch(url);
    const html = response.getContentText();
    Logger.log("HTML recuperato: " + html.substring(0, 200));

  const airQuality = extractDataRegex(html, '<span.*?data-testid="AirQualityCategory".*?>(.*?)</span>');
    const pm10 = extractDataRegex(html, '<span.*?data-testid="AirQualityMeasurement".*?>(.*?)</span>');
    const so2 = extractDataRegex(html, /SO2\s*\(.*?\)<\/span>[\s\S]*?data-testid="AirQualityMeasurement">([^<]+)<\/span>/);
    


    const data = {
      airQuality: airQuality,
      pm10: pm10,
      so2: so2
    };

    Logger.log("Dati recuperati: " + JSON.stringify(data));

    return data;

  } catch (error) {
    Logger.log("Errore durante lo scraping: " + error);
    return {
      airQuality: "Errore",
      pm10: "Errore",
      so2: "Errore"
    };
  }
}

function extractDataRegex(html, regexString) {
  try {
    Logger.log("Tentativo di estrazione con regex: " + regexString);
    const regex = new RegExp(regexString);
    const match = regex.exec(html);

    if (match && match.length > 1) {
      Logger.log("Corrispondenza trovata: " + match[1]);
      return match[1].trim();
    } else {
      Logger.log("Nessuna corrispondenza trovata per la regex");
      return "Non disponibile";
    }
  } catch (error) {
    Logger.log("Errore nell'estrazione dati con regex " + regexString + ": " + error);
    return "Non disponibile";
  }
}


function extractDataRegex(html, regexString) {
  try {
    Logger.log("Tentativo di estrazione con regex: " + regexString);
    const regex = new RegExp(regexString);
    const match = regex.exec(html);

    if (match && match.length > 1) {
      Logger.log("Corrispondenza trovata: " + match[1]);
      return match[1].trim();
    } else {
      Logger.log("Nessuna corrispondenza trovata per la regex");
      return "Non disponibile";
    }
  } catch (error) {
    Logger.log("Errore nell'estrazione dati con regex " + regexString + ": " + error);
    return "Non disponibile";
  }
}

// Funzione per recuperare tutti i dati meteo, inclusa la qualità dell'aria
function getAllWeatherData() {
  Logger.log("getAllWeatherData chiamata"); // AGGIUNTO

  const realtimeData = getCasamassimaWeatherData();
  const historicalTemperature = getCasamassimaLastHistoricalTemperature();
  const historicalHumidity = getCasamassimaLastHistoricalHumidity();
  let airQualityData = {};

  try {
    airQualityData = scrapeWeatherData(); // Chiama la funzione dallo scraper
  } catch (e) {
    Logger.log("Errore durante lo scraping della qualità dell'aria: " + e);
    airQualityData = { airQuality: "Errore", pm10: "Errore", so2: "Errore" };
  }

  const allData = {
    realtime: realtimeData || {},
    historical: {
      temperature: historicalTemperature,
      humidity: historicalHumidity
    },
    airQuality: airQualityData || {} // Includi i dati sulla qualità dell'aria
  };

  Logger.log("Dati completi: " + JSON.stringify(allData));

  return allData;
}

// Funzione per gestire le richieste API (GET)
function degreesToCardinal(degrees) {
  if (degrees === null || degrees === undefined) {
    return "N/A";
  }

  if (typeof degrees !== 'number' || isNaN(degrees)) {
    return "Invalid Direction";
  }

  if (degrees < 0 || degrees > 360) { // Aggiungi questo controllo
    return "Invalid Direction";
  }

  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const index = Math.round(((degrees %= 360) < 0 ? degrees + 360 : degrees) / 45) % 8;
  return directions[index];
}

function doGet(e) {
  Logger.log("doGet chiamata con parametri: " + JSON.stringify(e));
  const weatherData = getAllWeatherData();
  let direzioneGradi;
  let direzioneCardinale;
  let direzioneIconClass = "fas fa-question"; // Inizializza con un'icona di default

  if (weatherData.realtime && weatherData.realtime["Direzione Vento (gradi)"] != undefined && weatherData.realtime["Direzione Vento (gradi)"] != null) {
    direzioneGradi = Number(weatherData.realtime["Direzione Vento (gradi)"]); //Converti a numero
    Logger.log("Valore di direzioneGradi prima di degreesToCardinal: " + direzioneGradi);
    direzioneCardinale = degreesToCardinal(direzioneGradi);

    // Mapping delle direzioni cardinali a icone specifiche (SENZA ROTAZIONE)
    const direzioneIconMap = {
      "N": "fas fa-arrow-down",
      "NE": "fas fa-arrow-down-left",
      "E": "fas fa-arrow-left",
      "SE": "fas fa-arrow-up-left",
      "S": "fas fa-arrow-up",
      "SO": "fas fa-arrow-up-right",
      "O": "fas fa-arrow-right",
      "NO": "fas fa-arrow-down-right",
      "N/A": "fas fa-question",
      "Invalid Direction": "fas fa-exclamation-triangle"
    };

    direzioneIconClass = direzioneIconMap[direzioneCardinale] || "fas fa-question";

  } else {
    direzioneGradi = null;
    direzioneCardinale = "N/A";

  }

  if (weatherData) {
    const velocitaVento = Number(weatherData.realtime["Velocità Vento"]); // Assicurati che sia un numero
    let forzaVento = "";
    let forzaVentoIcon = "";

    // Classificazione della forza del vento (scala Beaufort semplificata)
    if (velocitaVento < 1) {
      forzaVento = "Calma";
      forzaVentoIcon = "fa-wind-calm";
    } else if (velocitaVento < 5) {
      forzaVento = "Brezza leggera";
      forzaVentoIcon = "fa-wind-light";
    } else if (velocitaVento < 11) {
      forzaVento = "Brezza tesa";
      forzaVentoIcon = "fa-wind-moderate";
    } else if (velocitaVento < 19) {
      forzaVento = "Vento moderato";
      forzaVentoIcon = "fa-wind";
    } else if (velocitaVento < 30) {
      forzaVento = "Vento forte";
      forzaVentoIcon = "fa-wind-strong";
    } else {
      forzaVento = "Tempesta";
      forzaVentoIcon = "fa-wind-gusts";
    }

    //Gestione umidità
    let umiditaRelativa = weatherData.historical["humidity"];
    if (umiditaRelativa === "Nessun dato storico di umidità disponibile" || umiditaRelativa === "Errore nel recupero dei dati dell'umidità" || umiditaRelativa === "Errore durante l'esecuzione della funzione" || umiditaRelativa === null) {
      umiditaRelativa = "N/A";
    }
// Ottieni i dati sulla qualità dell'aria
    const airQuality = weatherData.airQuality;

    // Crea una pagina HTML con i dati
    const output = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Meteo Turi</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" integrity="sha512-9usAa10IRO0HhonpyAIVpjrylPvoDwiPUiKdWk5t3PyolY1cOd4DSE0Ga+ri4AuTroPR5aQvXU9xC6qOPnzFeg==" crossorigin="anonymous" referrerpolicy="no-referrer" />
        <style>
          body {
            font-family: 'Arial', sans-serif;
            background-color: #e0f2f7;
            color: #333;
            margin: 0;
            padding: 20px;
            text-align: center;
          }

          h1 {
            color: #2962ff;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
            margin-bottom: 30px;
            animation: fadeIn 1s ease-in-out;
          }

          .weather-item {
            background-color: #fff;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            text-align: left;
            animation: slideIn 0.5s ease-out forwards;
            opacity: 0;
            font-size: 16px;
          }

          .weather-item i {
            margin-right: 10px;
            color: #64b5f6;
          }

          b {
            color: #1565c0;
          }

          /* Icona del vento più grande */
          .wind-icon {
            font-size: 2em;
            display: inline-block;
            color: #2962ff;
          }

          /* Animazioni */
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }

          /* Media query per schermi più piccoli */
          @media (max-width: 600px) {
            body { padding: 10px; }
            h1 { font-size: 24px; }
            .weather-item { padding: 10px; font-size: 14px; }
          }
        </style>
      </head>
      <body>
        <h1><i class="fas fa-sun"></i> Meteo Turi (Tempo Reale)</h1>
        <div class="weather-item" style="animation-delay: 0.2s;"><b><i class="fas fa-clock"></i> Ultimo Aggiornamento:</b> ${weatherData.realtime["Ultimo Aggiornamento"]}</div>
        <div class="weather-item" style="animation-delay: 0.4s;"><b><i class="fas fa-thermometer-half"></i> Temperatura Aria:</b> ${weatherData.realtime["Temperatura Aria"]} °C</div>
        <div class="weather-item" style="animation-delay: 0.6s;"><b><i class="fas fa-tint"></i> Intensità Pioggia:</b> ${weatherData.realtime["Intensità Pioggia"]} mm/min</div>
        <div class="weather-item" style="animation-delay: 0.8s;"><b><i class="fas fa-cloud-rain"></i> Pioggia Totale Oggi:</b> ${weatherData.realtime["Pioggia Totale Oggi"]} mm</div>
        <div class="weather-item" style="animation-delay: 1.0s;">
           <b><i class="${direzioneIconClass} wind-icon"></i> Direzione Vento:</b> ${direzioneGradi}° (${direzioneCardinale})
        </div>
        <div class="weather-item" style="animation-delay: 1.1s;">
          <b><i class="fas fa-tint"></i> Umidità Relativa:</b> ${umiditaRelativa}%
        </div>
        <div class="weather-item" style="animation-delay: 1.2s;"><b><i class="fas fa-tachometer-alt"></i> Velocità Vento:</b> ${weatherData.realtime["Velocità Vento"]} m/s (${(forzaVento)})</div>

        <h2>Qualità dell'Aria</h2>
        <div class="weather-item" style="animation-delay: 1.3s;"><b>Qualità dell'Aria:</b> ${airQuality.airQuality}</div>
        <div class="weather-item" style="animation-delay: 1.4s;"><b>PM10:</b> ${airQuality.pm10}</div>
        <div class="weather-item" style="animation-delay: 1.5s;"><b>SO2:</b> ${airQuality.so2}</div>
      </body>
      </html>
    `;

    return HtmlService.createHtmlOutput(output);
  } else {
    return HtmlService.createHtmlOutput(`
       <!DOCTYPE html>
      <html>
      <head>
        <title>Meteo Turi</title>
          <style>
          body { font-family: 'Arial', sans-serif;
                background-color: #ffebee;
                color: #d32f2f;
                margin: 0;
                padding: 20px;
                text-align: center;
          }
        </style>
      </head>
      <body>
         <h1><i class="fas fa-exclamation-triangle"></i> Errore: Dati meteo non disponibili.</h1>
      </body>
      </html>
    `);
  }
}
