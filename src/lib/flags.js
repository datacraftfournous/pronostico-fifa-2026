export const TEAM_FLAGS = {
  'México': 'mx', 'Sudáfrica': 'za', 'Corea del Sur': 'kr', 'Chequia': 'cz',
  'Canadá': 'ca', 'Bosnia y Herzegovina': 'ba', 'Estados Unidos': 'us', 'Paraguay': 'py',
  'Catar': 'qa', 'Suiza': 'ch', 'Brasil': 'br', 'Marruecos': 'ma',
  'Haití': 'ht', 'Escocia': 'gb-sct', 'Australia': 'au', 'Turquía': 'tr',
  'Alemania': 'de', 'Curazao': 'cw', 'Países Bajos': 'nl', 'Japón': 'jp',
  'Costa de Marfil': 'ci', 'Ecuador': 'ec', 'Suecia': 'se', 'Túnez': 'tn',
  'España': 'es', 'Cabo Verde': 'cv', 'Bélgica': 'be', 'Egipto': 'eg',
  'Arabia Saudita': 'sa', 'Uruguay': 'uy', 'Irán': 'ir', 'Nueva Zelanda': 'nz',
  'Francia': 'fr', 'Senegal': 'sn', 'Irak': 'iq', 'Noruega': 'no',
  'Argentina': 'ar', 'Argelia': 'dz', 'Austria': 'at', 'Jordania': 'jo',
  'Portugal': 'pt', 'RD Congo': 'cd', 'Inglaterra': 'gb-eng', 'Croacia': 'hr',
  'Ghana': 'gh', 'Panamá': 'pa', 'Uzbekistán': 'uz', 'Colombia': 'co',
}

export function getFlagUrl(teamName) {
  const code = TEAM_FLAGS[teamName]
  if (!code) return null
  return `https://flagcdn.com/24x18/${code}.png`
}