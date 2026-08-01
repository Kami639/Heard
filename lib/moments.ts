/* Moments: the things only you know about a show.
 *
 * No API can tell us you crowd-surfed, got upgraded, or cried during the last
 * song. So these are one-tap toggles on the concert page, and the achievement
 * system reads them like any other data. */

export interface Moment { id: string; icon: string; label: string }

export const MOMENTS: Moment[] = [
  // the crowd
  { id: "frontrow", icon: "🤝", label: "Barricade / front row" },
  { id: "pit", icon: "🌀", label: "Went in the pit" },
  { id: "crowdsurf", icon: "🌊", label: "Crowd surfed" },
  { id: "handtouch", icon: "🙌", label: "Artist touched my hand" },
  { id: "mic", icon: "🎙️", label: "Sang into the mic" },
  { id: "everyword", icon: "🧠", label: "Knew every word" },
  // the night
  { id: "friends", icon: "🤝", label: "Went with friends" },
  { id: "lastminute", icon: "📍", label: "Got tickets same day" },
  { id: "upgraded", icon: "🎲", label: "Got upgraded seats" },
  { id: "aftermidnight", icon: "🌅", label: "Left after midnight" },
  { id: "flew", icon: "✈️", label: "Flew there" },
  // what happened on stage
  { id: "setlistchanged", icon: "⚠️", label: "Setlist changed on the fly" },
  { id: "raindelay", icon: "🌧️", label: "Weather delay" },
  { id: "stopped", icon: "🚨", label: "Show was stopped" },
  { id: "fullalbum", icon: "🎼", label: "Played an album front to back" },
  { id: "anniversary", icon: "💿", label: "Album anniversary show" },
  { id: "demo", icon: "📼", label: "Heard a demo / unreleased cut" },
  // feelings
  { id: "cried", icon: "😭", label: "Cried" },
  { id: "fellinlove", icon: "❤️", label: "Went with someone I later dated" },
  { id: "characterdev", icon: "💔", label: "Went with someone I'm no longer with" },
  { id: "film", icon: "📸", label: "Shot it on film" },
];

export const momentById = (id: string) => MOMENTS.find((m) => m.id === id);
