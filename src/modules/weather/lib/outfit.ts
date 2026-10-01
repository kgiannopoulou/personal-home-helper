import { hourOf, hoursOf, isSnow, isStorm, round } from './weather';
import type { Forecast, HourWeather } from './types';

export interface AdviceItem {
  emoji: string;
  text: string;
}

export interface Outfit {
  headline: string;
  /** "8° → 19° · rain likely 14:00–17:00" */
  summary: string;
  items: AdviceItem[];
}

const LAYERS = [
  { max: 0, emoji: '🧣', text: 'Winter coat, hat, scarf and gloves' },
  { max: 7, emoji: '🧥', text: 'Warm coat with a jumper underneath' },
  { max: 13, emoji: '🧥', text: 'Jacket with a hoodie or jumper' },
  { max: 18, emoji: '👕', text: 'Light jacket or hoodie' },
  { max: 24, emoji: '👕', text: 'T-shirt, with a light layer just in case' },
  { max: Infinity, emoji: '🩳', text: 'T-shirt and shorts or a light dress' },
];

export const layerIndex = (feels: number) => LAYERS.findIndex((l) => feels < l.max);

const avg = (hs: HourWeather[]) => (hs.length ? hs.reduce((t, h) => t + h.feels, 0) / hs.length : NaN);

/** Groups consecutive rainy hours: "14:00–17:00". */
export function rainWindow(hours: HourWeather[], threshold: number): string | null {
  const wet = hours.filter((h) => h.rainChance >= threshold || h.rain >= 0.5);
  if (!wet.length) return null;
  const first = hourOf(wet[0]);
  const lastHour = Number(wet[wet.length - 1].time.slice(11, 13)) + 1;
  return `${first}–${String(lastHour % 24).padStart(2, '0')}:00`;
}

/**
 * What to wear for the hours you're out (07–22 by default), based on how warm it *feels*,
 * rain, wind, snow and UV. Handles "chilly morning, warm afternoon" with layers.
 */
export function outfitAdvice(forecast: Forecast, date: string, fromHour = 7, toHour = 22): Outfit | null {
  const day = hoursOf(forecast, date, fromHour, toHour);
  if (!day.length) return null;
  const morning = day.filter((h) => Number(h.time.slice(11, 13)) < 11);
  const afternoon = day.filter((h) => {
    const hr = Number(h.time.slice(11, 13));
    return hr >= 12 && hr < 18;
  });
  const evening = day.filter((h) => Number(h.time.slice(11, 13)) >= 18);
  const feels = day.map((h) => h.feels);
  const coldest = Math.min(...feels);
  const warmest = Math.max(...feels);
  const am = avg(morning.length ? morning : day);
  const pm = avg(afternoon.length ? afternoon : day);
  const pmIndex = layerIndex(pm);
  const amIndex = layerIndex(am);

  const items: AdviceItem[] = [];
  let headline: string;

  if (pm - am >= 6 && pmIndex > amIndex) {
    headline = `Chilly morning, ${pm >= 18 ? 'warm' : 'milder'} afternoon`;
    items.push({
      emoji: LAYERS[amIndex].emoji,
      text: `${round(am)} in the morning but ${round(pm)} later: ${LAYERS[amIndex].text.toLowerCase()}, with a ${pm >= 18 ? 't-shirt' : 'light top'} underneath you can strip down to.`,
    });
  } else {
    const index = layerIndex(Math.min(am, pm));
    headline = ['Freezing', 'Cold', 'Cool', 'Mild', 'Warm', 'Hot'][index] + ' day';
    items.push({ emoji: LAYERS[index].emoji, text: LAYERS[index].text });
  }
  const ev = avg(evening);
  if (evening.length && pm - ev >= 5 && layerIndex(ev) < pmIndex) {
    items.push({ emoji: '🌙', text: `Cooler in the evening (${round(ev)}): bring a layer if you're out late.` });
  }

  const maxChance = Math.max(...day.map((h) => h.rainChance));
  const totalRain = day.reduce((t, h) => t + h.rain, 0);
  const snow = day.some((h) => isSnow(h.code));
  const storm = day.some((h) => isStorm(h.code));
  const maxWind = Math.max(...day.map((h) => h.wind));
  // Rounded first so the advice matches the number shown ("UV 6" is always high).
  const maxUv = Math.round(Math.max(...day.map((h) => h.uv)));
  const rainy = maxChance >= 60 || totalRain >= 1;

  if (snow) {
    headline = 'Snow today';
    items.push({ emoji: '🥾', text: 'Warm boots with good grip. Pavements may be slippery.' });
  } else if (rainy) {
    const when = rainWindow(day, 50);
    if (!headline.includes('afternoon')) headline = `${headline.replace(' day', '')} and rainy`;
    items.push({ emoji: '🌧️', text: `Rain likely${when ? ` around ${when}` : ''} (${maxChance}%): waterproof jacket and an umbrella.` });
    items.push({ emoji: '🥾', text: 'Waterproof shoes or boots. Skip suede and canvas trainers.' });
  } else if (maxChance >= 30) {
    items.push({ emoji: '🌂', text: `Might rain (${maxChance}%): pack a small umbrella.` });
  }
  if (storm) items.push({ emoji: '⛈️', text: 'Thunderstorms possible. Plan to be indoors if it starts.' });

  if (maxWind >= 40) items.push({ emoji: '💨', text: `Very windy (${Math.round(maxWind)} km/h): a hood beats an umbrella today.` });
  else if (maxWind >= 25) items.push({ emoji: '🌬️', text: `Breezy (${Math.round(maxWind)} km/h): a windproof layer helps.` });

  if (maxUv >= 6) items.push({ emoji: '🧴', text: `UV is high (${Math.round(maxUv)}): sunscreen, sunglasses and a cap.` });
  else if (maxUv >= 3) items.push({ emoji: '🕶️', text: `Some sun (UV ${Math.round(maxUv)}): sunglasses, and sunscreen if you're outside long.` });

  if (warmest >= 28) items.push({ emoji: '💧', text: 'Hot: carry a water bottle and stay in the shade at midday.' });

  if (!snow && !rainy) {
    items.push(
      warmest >= 24
        ? { emoji: '👡', text: 'Breathable trainers or sandals.' }
        : coldest < 3
          ? { emoji: '🥾', text: 'Warm, closed shoes.' }
          : { emoji: '👟', text: 'Your usual trainers are fine.' },
    );
  }

  const when = rainWindow(day, 50);
  const summary = [`${round(coldest)} → ${round(warmest)}`, rainy && when ? `rain ${when}` : maxChance >= 30 ? `${maxChance}% rain` : 'dry'].join(' · ');
  return { headline, summary, items };
}
