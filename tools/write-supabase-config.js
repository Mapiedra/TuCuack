'use strict';

/**
 * Escribe supabase.json a partir de las variables de entorno.
 *
 * Lo usa el workflow de release para meter las credenciales del chat en el
 * instalador sin que pasen por el repositorio. Está en Node (y no en el shell)
 * para que funcione igual en los runners de Windows y de macOS.
 *
 * Si no hay credenciales no falla: simplemente no escribe nada y la app se
 * compila sin chat.
 */

const fs = require('fs');
const path = require('path');

const url = (process.env.SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const destino = path.join(__dirname, '..', 'supabase.json');

if (!url || !key) {
  console.log('Sin credenciales de Supabase: se compila sin chat.');
  process.exit(0);
}

fs.writeFileSync(destino, JSON.stringify({ url, publishableKey: key }, null, 2) + '\n');
console.log('supabase.json escrito: el instalador llevará el chat activado.');
