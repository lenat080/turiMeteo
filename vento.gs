function degreesToCardinal(degrees) {
  if (degrees === null || degrees === undefined) {
    return "N/A"; // Gestisci il caso in cui direzioneVento è null
  }

  degrees = Number(degrees); // Assicura che sia un numero.
  if (isNaN(degrees)) {
    return "Invalid Direction"; // Gestisci il caso in cui degrees non è un numero valido
  }

  const normalizedDegrees = degrees % 360; // Assicura che l'angolo sia tra 0 e 359

  if (normalizedDegrees >= 337.5 || normalizedDegrees < 22.5) {
    return "N";
  } else if (normalizedDegrees >= 22.5 && normalizedDegrees < 67.5) {
    return "NE";
  } else if (normalizedDegrees >= 67.5 && normalizedDegrees < 112.5) {
    return "E";
  } else if (normalizedDegrees >= 112.5 && normalizedDegrees < 157.5) {
    return "SE";
  } else if (normalizedDegrees >= 157.5 && normalizedDegrees < 202.5) {
    return "S";
  } else if (normalizedDegrees >= 202.5 && normalizedDegrees < 247.5) {
    return "SO";
  } else if (normalizedDegrees >= 247.5 && normalizedDegrees < 292.5) {
    return "O";
  } else if (normalizedDegrees >= 292.5 && normalizedDegrees < 337.5) {
    return "NO";
  }

  return "Invalid Direction";
}
